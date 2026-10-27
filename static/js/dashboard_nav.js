document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('dash-nav-toggle');
    const nav = document.getElementById('dash-nav') || document.querySelector('.dash-nav');
    const overlay = document.getElementById('dash-nav-overlay');

    if (!toggle || !nav) return;

    if (!nav.id) nav.id = 'dash-nav';
    toggle.setAttribute('aria-controls', nav.id);

    function isOpen() {
        return document.body.classList.contains('dash-nav-open');
    }

    function openDrawer() {
        document.body.classList.add('dash-nav-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close navigation menu');
        if (overlay) overlay.classList.add('is-visible');
        const first = nav.querySelector('a, button');
        if (first) {
            window.setTimeout(() => first.focus(), 50);
        }
    }

    function closeDrawer(restoreFocus = true) {
        if (!isOpen()) return;
        document.body.classList.remove('dash-nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
        if (overlay) overlay.classList.remove('is-visible');
        if (restoreFocus) toggle.focus();
    }

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (isOpen()) closeDrawer();
        else openDrawer();
    });

    if (overlay) {
        overlay.addEventListener('click', closeDrawer);
    }

    nav.querySelectorAll('a, button').forEach((item) => {
        item.addEventListener('click', () => {
            window.setTimeout(() => closeDrawer(false), 0);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) {
            closeDrawer();
            return;
        }
        if (event.key !== 'Tab' || !isOpen()) return;
        const focusable = Array.from(nav.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])'))
            .filter((el) => !el.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    document.addEventListener('click', (event) => {
        if (!isOpen()) return;
        if (nav.contains(event.target) || toggle.contains(event.target)) return;
        closeDrawer();
    });
});
