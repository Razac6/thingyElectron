// Thingy Companion - Background Worker
const API_URL = 'http://127.0.0.1:3333/api';
let syncIntervalMinutes = 60; // Default
let lastSyncTime = Date.now();

// Create Context Menu on Install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "thingy-add-task",
    title: "Add to Thingy",
    contexts: ["page", "selection"]
  });
});

// Handle Context Menu Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "thingy-add-task" && tab && tab.id) {
    // Send message to Content Script to parse the page
    chrome.tabs.sendMessage(tab.id, { 
      type: 'PARSE_TASK',
      selectionText: info.selectionText 
    }).catch(err => console.log('Could not send message to tab (probably restricted url):', err));
  }
});

// Listener for content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG_ACTIVITY') {
    addToBuffer(message.data);
  }
  
  // Handle Parsed Task from Content Script
  if (message.type === 'TASK_PARSED') {
    sendTaskToElectron(message.data);
  }

  // Handle Manual Block Update from Popup
  if (message.type === 'UPDATE_RULES') {
      checkStatus(); // Force refresh rules
  }
});

const sendTaskToElectron = async (taskData: any) => {
  try {
    const res = await fetch(`${API_URL}/task/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    });
    if (res.ok) {
      console.log('Task draft sent to Thingy!');
      chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/128x128.png',
          title: 'Thingy',
          message: 'Task added successfully!',
          priority: 1
      });
    }
  } catch (e) {
    console.error('Failed to send task to Thingy', e);
  }
};

const addToBuffer = async (activity: any) => {
  const result = await chrome.storage.local.get(['activityBuffer']);
  const buffer = result.activityBuffer || [];
  buffer.push(activity);
  await chrome.storage.local.set({ activityBuffer: buffer });
};

const flushData = async (force: boolean = false) => {
  const result = await chrome.storage.local.get(['activityBuffer']);
  const buffer = result.activityBuffer || [];
  
  if (buffer.length === 0 && !force) return;

  console.log('Flushing data...', buffer.length, 'items');

  try {
    const res = await fetch(`${API_URL}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buffer)
    });
    
    if (res.ok) {
        // Clear buffer ONLY on success
        await chrome.storage.local.set({ activityBuffer: [] });
        lastSyncTime = Date.now();
        console.log(`Synced ${buffer.length} items successfully.`);
    }
  } catch (e) {
      console.error('Sync failed', e);
  }
};

const updateBlockingRules = async (settings: any, focusMode: boolean) => {
  let sitesToBlock: string[] = [];

  // 0. Local Extension Blocks (Force Block)
  const { localBlockedSites } = await chrome.storage.local.get(['localBlockedSites']);
  if (localBlockedSites && Array.isArray(localBlockedSites)) {
      sitesToBlock.push(...localBlockedSites);
  }

  // 1. Always Blocked Sites (From Desktop)
  if (settings && settings.alwaysBlockedSites && Array.isArray(settings.alwaysBlockedSites)) {
      sitesToBlock.push(...settings.alwaysBlockedSites);
  }

  // 2. Focus Mode Blocked Sites (From Desktop)
  if (settings) {
      const shouldBlockFocus = settings.blockingEnabled && (!settings.blockOnlyInFocus || focusMode);
      if (shouldBlockFocus && settings.blockedSites && Array.isArray(settings.blockedSites)) {
          sitesToBlock.push(...settings.blockedSites);
      }
  }

  // Deduplicate and filter empty/invalid
  sitesToBlock = [...new Set(sitesToBlock)].filter(s => {
      if (!s || s.trim().length === 0) return false;
      
      // Safety Filter: Never block entire YouTube
      const clean = s.trim().toLowerCase();
      if (clean === 'youtube.com' || clean === 'www.youtube.com' || clean === '||youtube.com' || clean === '||www.youtube.com') {
          console.log('[Thingy] Blocked attempt to restrict entire YouTube domain. Filtered.');
          return false;
      }
      return true;
  });
  
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map((r: any) => r.id);
  
  if (sitesToBlock.length === 0) {
    if (oldRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
      console.log('Blocking disabled - rules cleared.');
    }
    await chrome.storage.local.set({ blockedPatterns: [] }); // CLEAR STORAGE
    chrome.action.setIcon({ path: "assets/16x16.png" }); 
    return;
  }

  const newRules: any[] = sitesToBlock.map((site: string, index: number) => {
    // Better filter formatting
    let filter = site;
    
    // If it's a specific path like "youtube.com/shorts", verify format
    // ||youtube.com/shorts matches http://youtube.com/shorts*
    
    if (!filter.startsWith('||') && !filter.startsWith('*') && !filter.startsWith('http')) {
        filter = `||${filter}`;
    }
    
    return {
        id: index + 1,
        priority: 1,
        action: { 
          type: 'redirect',
          redirect: { extensionPath: '/blocked.html' }
        },
        condition: { urlFilter: filter, resourceTypes: ['main_frame', 'xmlhttprequest'] }
    };
  });

  // Only update if rules changed (optimization) to avoid flickering
  // For now, naive implementation is fine as Chrome handles diffing reasonably well
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: newRules
  });
  
  // Set Icon to Red if blocking is active
  chrome.action.setIcon({ path: "assets/128x128.png" }); 
  
  // Save rules to storage for Content Script (SPA handling)
  await chrome.storage.local.set({ blockedPatterns: sitesToBlock });

  console.log('Blocking enabled for:', sitesToBlock);
};

const checkStatus = async () => {
  try {
    const res = await fetch(`${API_URL}/status`);
    const data = await res.json();
    
    // Check Master Switch
    if (data.integrationEnabled === false) {
        console.log('Integration disabled by user.');
        await chrome.storage.local.set({ connected: false }); // Stop content scripts
        
        // Clear all rules if disabled
        const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
        if (oldRules.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRules.map((r: any) => r.id) });
        }
        chrome.action.setIcon({ path: "assets/16x16.png" }); 
        return;
    }

    await chrome.storage.local.set({ connected: true });
    
    if (data.settings && data.settings.syncInterval) {
        syncIntervalMinutes = data.settings.syncInterval;
    }

    await updateBlockingRules(data.settings, data.focusMode);

    // Check for Sync Triggers
    const timeSinceLastSync = (Date.now() - lastSyncTime) / 60000; // minutes
    
    if (data.syncRequest || timeSinceLastSync >= syncIntervalMinutes) {
        console.log('Triggering Sync. Reason:', data.syncRequest ? 'Manual Request' : 'Interval');
        await flushData(!!data.syncRequest);
    }

  } catch (err) {
    await chrome.storage.local.set({ connected: false });
    
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    if (oldRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRules.map((r: any) => r.id) });
    }
  }
};

// Poll every 5 seconds
setInterval(checkStatus, 5000);
checkStatus(); 
