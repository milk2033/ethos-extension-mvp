// contentScript.js
(function () {
    console.log('[EthosExt][cs] contentScript loaded');

    // Keep track of which <article> we've already handled
    const processedArticles = new WeakSet();

    // Small delay to avoid spamming the API
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function processReplies() {
        // 1) Grab all tweet articles (first is original, rest are replies)
        const articles = Array.from(document.querySelectorAll('article[role="article"]'));
        if (articles.length < 2) return;

        const replies = articles.slice(1);
        for (const article of replies) {
            // 2) Skip if already processed
            if (processedArticles.has(article)) continue;

            // 3) Find the @username span in this reply
            let handleSpan = article.querySelector(
                'div[data-testid="User-Name"] span:nth-child(2)'
            );
            if (!handleSpan) {
                const spans = Array.from(article.querySelectorAll('span'));
                handleSpan = spans.find(s => /^@[A-Za-z0-9_]+$/.test(s.textContent.trim()));
            }
            if (!handleSpan) {
                console.warn('[EthosExt][cs] no handle found for a reply; skipping');
                processedArticles.add(article);
                continue;
            }

            const username = handleSpan.textContent.trim().slice(1);
            console.log('[EthosExt][cs] fetching Ethos score for', username);

            // 4) Ask background.js for the score
            const response = await new Promise(res =>
                chrome.runtime.sendMessage({ action: 'fetchEthos', username }, res)
            );
            console.log('[EthosExt][cs] response for', username, response);

            const score =
                response?.success && typeof response.data.score === 'number'
                    ? response.data.score
                    : 0;

            // 5) Inject or update a single badge right after handleSpan
            let badge = handleSpan.nextElementSibling;
            if (badge && badge.classList.contains('ethos-badge')) {
                badge.textContent = ` [${score}]`;
            } else {
                badge = document.createElement('span');
                badge.className = 'ethos-badge';
                badge.textContent = ` [${score}]`;
                badge.style.marginLeft = '4px';
                badge.style.fontSize = '12px';
                badge.style.color = '#1DA1F2';
                if (handleSpan.nextSibling) {
                    handleSpan.parentNode.insertBefore(badge, handleSpan.nextSibling);
                } else {
                    handleSpan.parentNode.appendChild(badge);
                }
            }

            // 6) Mark this article done and pause before next
            processedArticles.add(article);
            await sleep(100);
        }
    }

    // Watch for new replies (infinite scroll, etc.)
    const observer = new MutationObserver(processReplies);
    observer.observe(document.body, { childList: true, subtree: true });

    // Run immediately on load
    processReplies();
})();
