// background.js


console.log('[EthosExt][bg] background.js loaded and running');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[EthosExt][bg] onMessage received:', msg);

    // respond to ping so we know messaging works
    if (msg.action === 'ping') {
        console.log('[EthosExt][bg] pong!');
        sendResponse({ pong: true });
        return;
    }

    // only handle fetchEthos beyond this point
    if (msg.action !== 'fetchEthos') return;

    const username = msg.username;
    const url = `https://api.ethos.network/api/v2/user/by/username/${username}`;
    console.log('[EthosExt][bg] fetching URL:', url);

    const headers = {
        'X-Ethos-Client': 'ethos-mvp-extension@0.1.2'
        // If you need authenticated endpoints, also add:
        // 'Authorization': 'Bearer YOUR_PRIVY_TOKEN'
    };

    fetch(url, { headers })
        .then(res => {
            console.log(`[EthosExt][bg] status for ${username}:`, res.status, res.statusText);
            res.headers.forEach((value, name) => {
                console.log(`[EthosExt][bg] header ${name}:`, value);
            });
            if (res.status === 429) {
                console.warn(`[EthosExt][bg] RATE LIMITED on ${username}`);
            }
            return res.text();
        })
        .then(text => {
            console.log(`[EthosExt][bg] raw body for ${username}:`, text);
            try {
                const data = JSON.parse(text);
                console.log('[EthosExt][bg] parsed JSON:', data);
                sendResponse({ success: true, data });
            } catch (e) {
                console.error('[EthosExt][bg] JSON parse error:', e);
                sendResponse({ success: false, error: 'JSON parse error' });
            }
        })
        .catch(err => {
            console.error('[EthosExt][bg] fetch error for', username, err);
            sendResponse({ success: false, error: err.message });
        });

    // indicate we'll call sendResponse asynchronously
    return true;
});
