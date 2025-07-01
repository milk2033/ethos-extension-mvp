// contentScript.js

const ETHOS_COLORS = {
    untrusted: '#B72B38',
    questionable: '#C29010',
    neutral: '#C1C0B6',
    reputable: '#2E7BC3',
    exemplary: '#127F31',
    revered: '#7A5EAF'
};

function getCategory(score) {
    if (score <= 799) return 'untrusted';
    if (score <= 1199) return 'questionable';
    if (score <= 1599) return 'neutral';
    if (score <= 1999) return 'reputable';
    if (score <= 2399) return 'exemplary';
    return 'revered';
}

(function () {
    console.log('[EthosExt][cs] loaded');

    const seen = new WeakSet();

    async function injectBadge(span) {
        if (seen.has(span)) return;
        seen.add(span);

        const txt = span.textContent.trim();
        if (!txt.startsWith('@')) return;
        const username = txt.slice(1);

        // fetch score
        const resp = await new Promise(res =>
            chrome.runtime.sendMessage({ action: 'fetchEthos', username }, res)
        );
        const score = (resp?.success && typeof resp.data.score === 'number')
            ? resp.data.score
            : 0;

        // if score is zero, remove any existing badge and skip
        const insertAfterEl = span.querySelector('a') || span;
        if (score === 0) {
            let oldBadge = insertAfterEl.nextElementSibling;
            while (oldBadge && oldBadge.getAttribute('data-ethos-badge') !== 'true') {
                oldBadge = oldBadge.nextElementSibling;
            }
            if (oldBadge) oldBadge.remove();
            return;
        }

        // sizing tweak: profile badges 12px, timeline badges 12px
        const isProfile = !!span.closest('div[data-testid="UserName"],div[data-testid="User-Name"]');
        const fontSize = isProfile ? '12px' : '12px';
        const fontWeight = isProfile ? '800' : '700';
        const padding = isProfile ? '2px 6px' : '1px 4px';
        const radius = isProfile ? '6px' : '4px';

        // pick colors
        const cat = getCategory(score);
        const bg = ETHOS_COLORS[cat];
        const fg = cat === 'neutral' ? '#1F2125' : '#FFFFFF';

        // find or create badge
        let badge = insertAfterEl.nextElementSibling;
        while (badge && badge.getAttribute('data-ethos-badge') !== 'true') {
            badge = badge.nextElementSibling;
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.setAttribute('data-ethos-badge', 'true');
            insertAfterEl.insertAdjacentElement('afterend', badge);
        }

        // apply inline styles
        Object.assign(badge.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            backgroundColor: bg,
            color: fg,
            fontSize,
            fontWeight,
            padding,
            borderRadius: radius,
            marginLeft: '4px',
            flex: '0 0 auto',
            width: 'auto',
            maxWidth: 'none'
        });

        badge.textContent = score;
    }

    function scan() {
        document.querySelectorAll('span').forEach(s => {
            if (/^\@[A-Za-z0-9_]+$/.test(s.textContent.trim())) {
                injectBadge(s);
            }
        });
    }

    scan();
    new MutationObserver(scan).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
