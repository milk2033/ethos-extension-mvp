// contentScript_userProfile.js
// this script injects the ethos badge on the user profile page 

(function () {
    console.log('[EthosExt][cs] contentScript loaded');

    let injected = false;

    // Poll every 500ms until we find the profile header, then stop
    const interval = setInterval(async () => {
        if (injected) {
            clearInterval(interval);
            return;
        }

        // 1) Find the profile header container
        const container = document.querySelector('div[data-testid="UserName"]');
        if (!container) return;

        // 2) Find the @username span inside it
        const handleSpan = Array.from(container.querySelectorAll('span'))
            .find(s => s.textContent.trim().startsWith('@'));
        if (!handleSpan) {
            console.log('[EthosExt][cs] handleSpan not yet in DOM');
            return;
        }

        injected = true;
        clearInterval(interval);

        const username = handleSpan.textContent.trim().slice(1);
        console.log('[EthosExt][cs] fetching Ethos score for profile', username);

        // 3) Fetch from background
        const response = await new Promise(res =>
            chrome.runtime.sendMessage({ action: 'fetchEthos', username }, res)
        );
        console.log('[EthosExt][cs] background response for profile:', response);

        const score = response?.success && typeof response.data.score === 'number'
            ? response.data.score
            : 0;
        console.log('[EthosExt][cs] computed profile score:', score);

        // 4) Inject the badge once
        const badge = document.createElement('span');
        badge.className = 'ethos-profile-badge';
        badge.textContent = ` [${score}]`;
        badge.style.marginLeft = '6px';
        badge.style.fontSize = '16px';
        badge.style.fontWeight = 'bold';
        badge.style.color = '#1DA1F2';

        handleSpan.insertAdjacentElement('afterend', badge);
        console.log('[EthosExt][cs] injected profile badge');
    }, 500);
})();
