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
    // Match Score Ring Animation
    // ------------------------------------------------------------------------
    const ringEl = document.getElementById('ring');
    const scoreNumEl = document.getElementById('score-num');

    if (ringEl && scoreNumEl) {
        let hasAnimatedRing = false;

        const ringObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && !hasAnimatedRing) {
                    hasAnimatedRing = true;
                    ringEl.classList.add('in-view');

                    // Animate score number from 0 to 87
                    const targetScore = 87;
                    const duration = 1200; // ms
                    const startTime = performance.now();

                    function updateCounter(currentTime) {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const easeOut = 1 - Math.pow(1 - progress, 3);
                        const currentVal = Math.round(easeOut * targetScore);
                        scoreNumEl.textContent = currentVal;

                        if (progress < 1) {
                            requestAnimationFrame(updateCounter);
                        } else {
                            scoreNumEl.textContent = targetScore;
                        }
                    }

                    requestAnimationFrame(updateCounter);
                }
            });
        }, { threshold: 0.3 });

        ringObserver.observe(ringEl);
    }

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
});
