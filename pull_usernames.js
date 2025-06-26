// contentScript.js
(function () {
    console.log('[ReplyScanner] contentScript loaded');

    function scanReplies() {
        // 1) Grab *all* tweet/reply articles
        const allArticles = Array.from(
            document.querySelectorAll('article[role="article"]')
        );
        console.log('[ReplyScanner] total articles found:', allArticles.length);

        if (allArticles.length < 2) {
            console.log('[ReplyScanner] no replies yet');
            return;
        }

        // 2) Everything after the first article is a reply
        const replyArticles = allArticles.slice(1);

        // 3) Extract the @handle from each reply by finding the span whose text starts with "@"
        const handles = replyArticles.map(article => {
            const spanList = Array.from(article.querySelectorAll('span'));
            const handleSpan = spanList.find(s => s.textContent.trim().startsWith('@'));
            return handleSpan
                ? handleSpan.textContent.trim()  // e.g. "@Wolf_defi_eth"
                : null;
        }).filter(Boolean);

        console.log('[ReplyScanner] reply @handles:', handles);
    }

    // initial run
    scanReplies();

    // re-run on DOM changes (infinite scroll, replies loading, etc.)
    new MutationObserver(scanReplies)
        .observe(document.body, { childList: true, subtree: true });
})();
