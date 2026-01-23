// Status Check
chrome.storage.local.get(['connected'], (result) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (result.connected) {
        dot?.classList.add('connected');
        if (text) text.innerText = 'Connected to Thingy Desktop';
    } else {
        dot?.classList.remove('connected');
        if (text) text.innerText = 'Disconnected (Working Offline)';
    }
});

// Current URL Handling
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const tab = tabs[0];
    const btn = document.getElementById('block-btn');
    if (!tab || !tab.url || !btn) return;

    const url = new URL(tab.url);
    let patternToBlock = url.hostname;

    // Force specific pattern for YouTube to avoid domain block
    if (url.hostname.includes('youtube.com')) {
        if (url.pathname.includes('/shorts')) {
            patternToBlock = 'youtube.com/shorts';
            btn.innerText = 'Block YouTube Shorts';
        } else {
            // If on main page, maybe offer to block shorts anyway?
            patternToBlock = 'youtube.com/shorts';
            btn.innerText = 'Block YT Shorts';
        }
    } else if (url.hostname.includes('facebook.com')) {
        patternToBlock = 'facebook.com';
        btn.innerText = 'Block Facebook';
    } else {
        btn.innerText = `Block ${url.hostname}`;
    }

    btn.onclick = () => addBlock(patternToBlock);
});

// Load List
const renderList = async () => {
    const { localBlockedSites } = await chrome.storage.local.get(['localBlockedSites']);
    const list = document.getElementById('blocked-list');
    const emptyMsg = document.getElementById('empty-msg');
    
    if (list) list.innerHTML = '';
    
    if (!localBlockedSites || localBlockedSites.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    
    if (emptyMsg) emptyMsg.style.display = 'none';

    localBlockedSites.forEach((site: string) => {
        const li = document.createElement('li');
        li.className = 'blocked-item';
        li.innerHTML = `
            <span>${site}</span>
            <button class="remove-btn" data-site="${site}">×</button>
        `;
        list?.appendChild(li);
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            removeBlock(e.target.dataset.site);
        });
    });
};

const addBlock = async (site: string) => {
    const { localBlockedSites } = await chrome.storage.local.get(['localBlockedSites']);
    const current = localBlockedSites || [];
    
    if (!current.includes(site)) {
        const newList = [...current, site];
        await chrome.storage.local.set({ localBlockedSites: newList });
        renderList();
        // Notify background to update rules
        chrome.runtime.sendMessage({ type: 'UPDATE_RULES' });
    }
};

const removeBlock = async (site: string) => {
    const { localBlockedSites } = await chrome.storage.local.get(['localBlockedSites']);
    const current = localBlockedSites || [];
    const newList = current.filter((s: string) => s !== site);
    
    await chrome.storage.local.set({ localBlockedSites: newList });
    renderList();
    // Notify background to update rules
    chrome.runtime.sendMessage({ type: 'UPDATE_RULES' });
};

renderList();
