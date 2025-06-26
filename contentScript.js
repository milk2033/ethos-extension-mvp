// contentScript.js
(function () {
    console.log('[EthosExt][cs] contentScript loaded');

    // Track processed tweets and spans, plus profile injection
    const processedArticles = new WeakSet();
    const processedSpans = new WeakSet();
    let profileInjected = false;

    // Helpers
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const debounce = (fn, ms) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    };

    // Ask background.js for an Ethos score
    function fetchScore(username) {
        return new Promise(res =>
            chrome.runtime.sendMessage({ action: 'fetchEthos', username }, res)
        ).then(resp =>
            resp?.success && typeof resp.data.score === 'number'
                ? resp.data.score
                : 0
        );
    }

    // Insert or update a badge next to the given handleSpan.
    // Uses a larger style if it’s on a profile page.
    async function injectBadge(handleSpan) {
        if (processedSpans.has(handleSpan)) return;
        processedSpans.add(handleSpan);

        const raw = handleSpan.textContent.trim();
        if (!raw.startsWith('@')) return;
        const username = raw.slice(1);

        const score = await fetchScore(username);
        const isProfile = !!handleSpan.closest('div[data-testid="UserName"]');
        const badgeClass = isProfile ? 'ethos-profile-badge' : 'ethos-badge';

        // Find any existing badge of this class
        let badge = handleSpan.nextElementSibling;
        while (badge && !badge.classList.contains(badgeClass)) {
            badge = badge.nextElementSibling;
        }

        if (badge) {
            // update existing
            badge.textContent = ` [${score}]`;
        } else {
            // create & style new badge
            badge = document.createElement('span');
            badge.className = badgeClass;
            badge.textContent = ` [${score}]`;
            badge.style.color = '#1DA1F2';

            if (isProfile) {
                badge.style.marginLeft = '6px';
                badge.style.fontSize = '16px';
                badge.style.fontWeight = 'bold';
            } else {
                badge.style.marginLeft = '4px';
                badge.style.fontSize = '12px';
            }

            handleSpan.insertAdjacentElement('afterend', badge);
        }
    }

    // Walk all tweets in the feed and inject badges
    async function processArticles() {
        const articles = Array.from(document.querySelectorAll('article[role="article"]'));
        for (const article of articles) {
            if (processedArticles.has(article)) continue;

            // Try the data-testid path first...
            let handleSpan = article.querySelector(
                'div[data-testid="User-Name"] span:nth-child(2)'
            );
            // ...otherwise fallback to any span starting with "@"
            if (!handleSpan) {
                handleSpan = Array.from(article.querySelectorAll('span')).find(s =>
                    /^\@[A-Za-z0-9_]+$/.test(s.textContent.trim())
                );
            }

            if (handleSpan) {
                await injectBadge(handleSpan);
            }

            processedArticles.add(article);
            await sleep(100);
        }
    }

    // On a user profile page, inject a single, larger badge
    async function processProfile() {
        if (profileInjected) return;

        const container = document.querySelector('div[data-testid="UserName"]');
        if (!container) return;

        const handleSpan = Array.from(container.querySelectorAll('span')).find(s =>
            s.textContent.trim().startsWith('@')
        );
        if (!handleSpan) return;

        await injectBadge(handleSpan);
        profileInjected = true;
    }

    // Observe DOM mutations, but debounce to once per 300ms
    const observer = new MutationObserver(
        debounce(() => {
            processArticles();
            processProfile();
        }, 300)
    );
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial invocation
    processArticles();
    processProfile();
})();
