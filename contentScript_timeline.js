// contentScript.js
// this script injects the ethos badge on the timeline

(function () {
    console.log('[EthosExt][cs] contentScript loaded');

    const processed = new WeakSet();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const debounce = (fn, ms) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    };

    async function processFeed() {
        const articles = Array.from(document.querySelectorAll('article[role="article"]'));
        console.log('[EthosExt][cs] found articles count:', articles.length);

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            console.group(`[EthosExt][cs] article #${i}`);
            console.log('DOM element:', article);

            if (processed.has(article)) {
                console.log('→ already processed, skipping');
                console.groupEnd();
                continue;
            }

            // 1) grab the User-Name container
            const userNameContainer = article.querySelector('div[data-testid="User-Name"]');
            console.log('userNameContainer:', userNameContainer);
            if (!userNameContainer) {
                console.warn('→ no [data-testid="User-Name"] here');
                processed.add(article);
                console.groupEnd();
                continue;
            }

            // 2) list out every <span> inside it
            const spans = Array.from(userNameContainer.querySelectorAll('span'));
            console.log('all spans in container:', spans.map(s => `"${s.textContent.trim()}"`));

            // 3) pick the one that starts with "@"
            const handleSpan = spans.find(s => s.textContent.trim().startsWith('@'));
            console.log('handleSpan found:', handleSpan);
            if (!handleSpan) {
                console.warn('→ no span starting with "@" found');
                processed.add(article);
                console.groupEnd();
                continue;
            }

            const raw = handleSpan.textContent.trim();
            const username = raw.slice(1);
            console.log('extracted username:', username);

            // 4) fetch Ethos score
            console.log('fetching Ethos for', username);
            const response = await new Promise(res =>
                chrome.runtime.sendMessage({ action: 'fetchEthos', username }, res)
            );
            console.log('fetchEthos response:', response);

            let score = 0;
            if (response?.success && typeof response.data.score === 'number') {
                score = response.data.score;
            } else {
                console.warn('→ invalid or missing score in response, defaulting to 0');
            }
            console.log('final score:', score);

            // 5) inject badge
            let badge = handleSpan.nextElementSibling;
            console.log('existing badge element:', badge);
            if (!(badge && badge.classList.contains('ethos-badge'))) {
                badge = document.createElement('span');
                badge.className = 'ethos-badge';
                badge.textContent = ` [${score}]`;
                badge.style.marginLeft = '4px';
                badge.style.fontSize = '12px';
                badge.style.color = '#1DA1F2';
                handleSpan.insertAdjacentElement('afterend', badge);
                console.log('→ injected new badge:', badge);
            } else {
                badge.textContent = ` [${score}]`;
                console.log('→ updated existing badge text');
            }

            processed.add(article);
            await sleep(100);
            console.groupEnd();
        }
    }

    const observer = new MutationObserver(debounce(processFeed, 300));
    observer.observe(document.body, { childList: true, subtree: true });

    // run once immediately
    processFeed();
})();
