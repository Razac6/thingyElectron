// Thingy Companion - Content Script
// Blocks YouTube Shorts elements and redirects Shorts URLs

const SHORTS_SELECTORS = [
  'ytd-rich-shelf-renderer[is-shorts]', // Shorts shelf on Home
  'ytd-reel-shelf-renderer',            // Standard Shorts shelf
  'a[href^="/shorts"]',                 // Links to Shorts
  'ytd-guide-entry-renderer a[title="Shorts"]', // Sidebar menu item
  'ytd-mini-guide-entry-renderer[aria-label="Shorts"]' // Mini sidebar item
];

function nukeShorts() {
  // 1. Check URL for hard redirection
  if (window.location.pathname.startsWith('/shorts/')) {
    const videoId = window.location.pathname.split('/shorts/')[1];
    if (videoId) {
      // Redirect to normal player view (optional, or just go home)
      // window.location.replace(`https://www.youtube.com/watch?v=${videoId}`);
      // For now, let's just go home to discourage usage
      window.location.replace('https://www.youtube.com/');
    }
  }

  // 2. Remove visual elements
  SHORTS_SELECTORS.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      // We use 'display: none' instead of remove() to avoid breaking YT's scripts
      (el as HTMLElement).style.display = 'none';
    });
  });
}

// Initial run
nukeShorts();

// Observer to handle dynamic loading (SPA navigation, infinite scroll)
const observer = new MutationObserver((mutations) => {
  let shouldRun = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldRun = true;
      break;
    }
  }
  if (shouldRun) {
    nukeShorts();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log('[Thingy Companion] Shorts blocker active.');
