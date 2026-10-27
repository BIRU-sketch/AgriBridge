document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // Mobile Navigation Drawer Toggle
    // ------------------------------------------------------------------------
    const navToggle = document.getElementById('nav-toggle');
    const siteNav = document.getElementById('site-nav');
    const siteHeader = document.getElementById('site-header');

    function closeNav() {
        document.body.classList.remove('nav-open');
        if (navToggle) {
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.setAttribute('aria-label', 'Open navigation menu');
        }
    }

    function openNav() {
        document.body.classList.add('nav-open');
        if (navToggle) {
            navToggle.setAttribute('aria-expanded', 'true');
            navToggle.setAttribute('aria-label', 'Close navigation menu');
        }
    }

    if (navToggle) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = document.body.classList.contains('nav-open');
            if (isOpen) {
                closeNav();
            } else {
                openNav();
            }
        });
    }

    // Close mobile nav when clicking a navigation link
    if (siteNav) {
        siteNav.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                closeNav();
            });
        });
    }

    // Close when clicking outside of the header
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('nav-open')) {
            if (siteHeader && !siteHeader.contains(e.target)) {
                closeNav();
            }
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
            closeNav();
            navToggle?.focus();
        }
    });

    // ------------------------------------------------------------------------
    // ScrollSpy for Nav Links
    // ------------------------------------------------------------------------
    const spyLinks = document.querySelectorAll('[data-spy]');
    const sections = [];

    spyLinks.forEach((link) => {
        const id = link.getAttribute('data-spy');
        const section = document.getElementById(id);
        if (section) {
            sections.push({ id, section, link });
        }
    });

    if (sections.length > 0) {
        window.addEventListener('scroll', () => {
            const scrollPos = window.scrollY + 140;
            let currentId = null;

            sections.forEach(({ id, section }) => {
                if (section.offsetTop <= scrollPos) {
                    currentId = id;
                }
            });

            if (currentId) {
                spyLinks.forEach((link) => {
                    if (link.getAttribute('data-spy') === currentId) {
                        link.setAttribute('aria-current', 'true');
                    } else {
                        link.removeAttribute('aria-current');
                    }
                });
            }
        }, { passive: true });
    }

    // ------------------------------------------------------------------------
    // Sticky Header Glass Effect on Scroll
    // ------------------------------------------------------------------------
    if (siteHeader) {
        const handleHeaderScroll = () => {
            if (window.scrollY > 16) {
                siteHeader.classList.add('is-scrolled');
            } else {
                siteHeader.classList.remove('is-scrolled');
            }
        };
        window.addEventListener('scroll', handleHeaderScroll, { passive: true });
        handleHeaderScroll();
    }

    // ------------------------------------------------------------------------
    // Scroll Reveal Observer (Subtle Entry Animations)
    // ------------------------------------------------------------------------
    const revealEls = document.querySelectorAll('.reveal');
    if (revealEls.length > 0) {
        if ('IntersectionObserver' in window) {
            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-revealed');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                root: null,
                rootMargin: '0px 0px -40px 0px',
                threshold: 0.08
            });

            revealEls.forEach((el) => revealObserver.observe(el));
        } else {
            revealEls.forEach((el) => el.classList.add('is-revealed'));
        }
    }
});
