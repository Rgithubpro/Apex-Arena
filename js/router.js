(function () {
    const pages = {
        'loading': 'loading-screen',
        'welcome': 'welcome-screen',
        'home': 'home-screen'
    };

    const allowedTransitions = {
        'initial': ['loading'],
        'loading': ['welcome', 'home'],
        'welcome': ['home'],
        'home': []
    };

    const DEFAULT_DURATION = 150; // ms

    let _currentPage = null;
    const modules = {};

    function showPage(page, duration = DEFAULT_DURATION) {
        if (!pages[page]) {
            console.warn(`Router: unknown page "${page}"`);
            return;
        }
        if (page === _currentPage) return;

        const outgoingKey = _currentPage;
        const allowedPages = allowedTransitions[outgoingKey ?? 'initial'];
        if (!allowedPages?.includes(page)) {
            console.warn(`Router: transition from "${outgoingKey}" to "${page}" is not allowed`);
            return;
        }

        const outgoingEl = outgoingKey ? document.getElementById(pages[outgoingKey]) : null;
        const incomingEl = document.getElementById(pages[page]);

        if (outgoingKey && modules[outgoingKey]?.stop) {
            modules[outgoingKey].stop();
        }

        // apply custom duration inline (overrides CSS default for this transition only)
        if (incomingEl) incomingEl.style.transitionDuration = `${duration}ms`;
        if (outgoingEl) outgoingEl.style.transitionDuration = `${duration}ms`;

        if (incomingEl) incomingEl.classList.add('active');

        if (outgoingEl) {
            outgoingEl.classList.remove('active');
            outgoingEl.classList.add('fading-out');
        }

        _currentPage = page;
        window.AppErrors?.breadcrumb('route_changed', { from: outgoingKey, to: page });
        if (modules[page]?.start) modules[page].start();

        if (outgoingEl) {
            setTimeout(() => {
                outgoingEl.classList.remove('fading-out');
                outgoingEl.style.transitionDuration = ''; // reset to CSS default
            }, duration);
        }
    }

    window.Router = {
        go: showPage,
        current: () => _currentPage,
        exists: (page) => !!pages[page],
        register: (page, moduleObj) => {
            modules[page] = moduleObj;
        }
    };

    window.addEventListener('load', () => {
        window.Router.go('loading');
    });
})();