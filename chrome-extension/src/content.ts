let startTime = Date.now();
let isActive = document.visibilityState === 'visible';

// --- Task Parsing Logic ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARSE_TASK') {
    const taskData = parsePageForTask(message.selectionText);
    chrome.runtime.sendMessage({ type: 'TASK_PARSED', data: taskData });
  }
});

const parsePageForTask = (selectionText: string | undefined) => {
  const url = window.location.href;
  const pageTitle = document.title;
  let title = selectionText || '';
  let description = url;

  // 1. Azure DevOps Strategies
  if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) {
    // Try to find Work Item ID
    const idElem = document.querySelector('.work-item-form-id span') || document.querySelector('.work-item-id');
    const titleElem = document.querySelector('.work-item-form-title input') as HTMLInputElement || document.querySelector('.work-item-title');
    
    if (idElem && titleElem) {
      const id = idElem.textContent || '';
      const rawTitle = titleElem.value || titleElem.textContent || '';
      
      // Try to find Story Points / Effort
      const effortInput = document.querySelector('input[aria-label="Story Points"]') as HTMLInputElement || 
                          document.querySelector('input[aria-label="Effort"]') as HTMLInputElement ||
                          document.querySelector('input[aria-label="Size"]') as HTMLInputElement;
      
      let storyPoints = 0;
      if (effortInput && effortInput.value) {
          storyPoints = parseFloat(effortInput.value) || 0;
      }

      // If we found specific ADO data, prefer it over selection
      if (!title) {
        title = `[${id}] ${rawTitle}`;
      } else {
        // If selection exists, just append ID
        title = `[${id}] ${title}`;
      }
      
      return {
        title: title.trim(),
        description: description,
        sourceUrl: url,
        storyPoints: storyPoints
      };
    }
  }

  // 2. Jira Strategies (Bonus)
  if (url.includes('atlassian.net') || url.includes('jira')) {
    const keyElem = document.querySelector('[data-test-id="issue.views.issue-base.foundation.breadcrumbs.current-issue-link"]');
    const summaryElem = document.querySelector('[data-test-id="issue.views.issue-base.foundation.summary.heading"]');
    
    if (keyElem && summaryElem) {
        const key = keyElem.textContent || '';
        const summary = summaryElem.textContent || '';
        if (!title) title = `[${key}] ${summary}`;
    }
  }

  // 3. Fallback: Page Title
  if (!title) {
    title = pageTitle;
  }

  return {
    title: title.trim(),
    description: description, // Always use URL as description/source
    sourceUrl: url
  };
};

// @ts-ignore
const syncActivity = async () => {
  const now = Date.now();
  const duration = now - startTime;
  
  // Ignoruj bardzo krótkie wizyty (< 1s)
  if (duration < 1000) return;

  const activity = {
    domain: window.location.hostname,
    url: window.location.href,
    duration: duration,
    timestamp: now
  };

  startTime = now; // Reset timer for next batch

  try {
     // Wysyłamy do background.ts zamiast bezpośrednio do API
     chrome.runtime.sendMessage({ type: 'LOG_ACTIVITY', data: activity });
  } catch (e) {
      // Ignore errors silently (np. gdy extension context jest inwalidowany przy update)
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    isActive = true;
    startTime = Date.now();
  } else {
    isActive = false;
    syncActivity();
  }
});

// Sync every 30 seconds if active
setInterval(() => {
    if (isActive) syncActivity();
}, 30000);

// Sync on close
window.addEventListener('beforeunload', () => {
    if (isActive) syncActivity();
});

// --- Client-Side SPA Blocking ---
let lastUrl = location.href;
const checkBlocking = async () => {
    const currentUrl = location.href;
    const { blockedPatterns } = await chrome.storage.local.get(['blockedPatterns']);
    
    if (!blockedPatterns || !Array.isArray(blockedPatterns)) return;

    for (const pattern of blockedPatterns) {
        if (!pattern || pattern.length < 3) continue;

        // Simple pattern matching
        const cleanPattern = pattern.replace(/^\|\|/, '');
        
        // Accurate matching: if pattern contains a slash, check if it's part of path
        // if not, check if it matches the hostname
        const isMatch = currentUrl.includes(cleanPattern);
        
        if (isMatch) {
            // Additional check for YouTube Shorts to avoid blocking main site if pattern is specific
            if (cleanPattern.includes('shorts') && !currentUrl.includes('/shorts')) {
                continue; // Don't block if we are on YT but NOT on shorts
            }

            // BLOCK!
            document.body.innerHTML = `
                <div style="
                    position: fixed; 
                    top: 0; left: 0; width: 100%; height: 100%; 
                    background: #f8f9fa; color: #333; 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    z-index: 999999; font-family: sans-serif;
                ">
                    <h1 style="font-size: 2rem; margin-bottom: 1rem;">🚫 Access Restricted</h1>
                    <p>This page is blocked by Thingy Focus Mode.</p>
                    <p style="margin-top: 2rem; color: #666;">Get back to work!</p>
                </div>
            `;
            // Stop media playback
            document.querySelectorAll('video, audio').forEach((el: any) => el.pause());
            return;
        }
    }
};

// Check on load
checkBlocking();

// Check on URL change (SPA)
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    checkBlocking();
  }
}).observe(document, { subtree: true, childList: true });
