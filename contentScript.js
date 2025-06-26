// contentScript.js
(function () {
    console.log('[EthosExt][cs] contentScript loaded');

    // 1) Inject global styles for our badges
    const style = document.createElement('style');
    style.textContent = `
      .ethos-badge {
        display: inline-block;
        background: #eaf5ff;
        color: #0366d6;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        margin-left: 4px;
      }
      .ethos-profile-badge {
        display: inline-block;
        background: #eaf5ff;
        color: #0366d6;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
        margin-left: 6px;
      }
    `;
    document.head.appendChild(style);

    // Track what we've processed
    const processedArticles = new WeakSet();
    const processedSpans = new WeakSet();
    let profileInjected = false;

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const debounce = (fn, ms) => {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    };

    // Fetch Ethos score
    function fetchScore(username) {
        return new Promise(res =>
            chrome.runtime.sendMessage({ action: 'fetchEthos', username }, res)
        ).then(resp =>
            resp?.success && typeof resp.data.score === 'number'
                ? resp.data.score
                : 0
        );
    }

    // Insert or update a badge next to handleSpan
    async function injectBadge(handleSpan) {
        if (processedSpans.has(handleSpan)) return;
        processedSpans.add(handleSpan);

        const raw = handleSpan.textContent.trim();
        if (!raw.startsWith('@')) return;
        const username = raw.slice(1);

        const score = await fetchScore(username);
        const isProfile = !!handleSpan.closest('div[data-testid="UserName"]');
        const cls = isProfile ? 'ethos-profile-badge' : 'ethos-badge';

        // find existing badge of this class
        let badge = handleSpan.nextElementSibling;
        while (badge && !badge.classList.contains(cls)) {
            badge = badge.nextElementSibling;
        }

        if (badge) {
            badge.textContent = score;
        } else {
            badge = document.createElement('span');
            badge.className = cls;
            badge.textContent = score;
            handleSpan.insertAdjacentElement('afterend', badge);
        }
    }

    // Process timeline & replies
    async function processArticles() {
        const articles = Array.from(document.querySelectorAll('article[role="article"]'));
        for (const art of articles) {
            if (processedArticles.has(art)) continue;

            let span = art.querySelector('div[data-testid="User-Name"] span:nth-child(2)');
            if (!span) {
                span = Array.from(art.querySelectorAll('span'))
                    .find(s => /^\@[A-Za-z0-9_]+$/.test(s.textContent.trim()));
            }
            if (span) await injectBadge(span);

            processedArticles.add(art);
            await sleep(100);
        }
    }

    // Process user profile header
    async function processProfile() {
        if (profileInjected) return;
        const container = document.querySelector('div[data-testid="UserName"]');
        if (!container) return;

        const span = Array.from(container.querySelectorAll('span'))
            .find(s => s.textContent.trim().startsWith('@'));
        if (!span) return;

        await injectBadge(span);
        profileInjected = true;
    }

    // Watch for new content
    const observer = new MutationObserver(debounce(() => {
        processArticles();
        processProfile();
    }, 300));
    observer.observe(document.body, { childList: true, subtree: true });

    // Run on load
    processArticles();
    processProfile();
})();
