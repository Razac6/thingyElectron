// Thingy Companion - Background Worker
const API_URL = 'http://127.0.0.1:3333/api';
let syncIntervalMinutes = 60; // Default
let lastSyncTime = Date.now();

// Listener for content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG_ACTIVITY') {
    addToBuffer(message.data);
  }
});

const addToBuffer = async (activity: any) => {
  const result = await chrome.storage.local.get(['activityBuffer']);
  const buffer = result.activityBuffer || [];
  buffer.push(activity);
  await chrome.storage.local.set({ activityBuffer: buffer });
};

const flushData = async () => {
  const result = await chrome.storage.local.get(['activityBuffer']);
  const buffer = result.activityBuffer || [];
  
  if (buffer.length === 0) return;

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
  const shouldBlock = settings.blockingEnabled && (!settings.blockOnlyInFocus || focusMode);
  
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map((r: any) => r.id);
  
  if (!shouldBlock) {
    if (oldRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
      console.log('Blocking disabled - rules cleared.');
    }
    chrome.action.setIcon({ path: "assets/16x16.png" }); 
    return;
  }

  const newRules = settings.blockedSites.map((site: string, index: number) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: site, resourceTypes: ['main_frame'] }
  }));

  // Only update if rules changed (optimization) to avoid flickering
  // For now, naive implementation is fine as Chrome handles diffing reasonably well
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: newRules
  });
  
  console.log('Blocking enabled for:', settings.blockedSites);
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
        await flushData();
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
