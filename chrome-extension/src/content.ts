let startTime = Date.now();
let isActive = document.visibilityState === 'visible';

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
