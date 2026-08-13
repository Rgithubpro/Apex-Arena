(function () {
    const pages = {
        'loading': 'loading-screen',
        'welcome': 'welcome-screen',
        'home': 'home-screen'
    };

    let _currentPage = null;
    const modules = {}; // pageName -> { start(), stop() }

    function showPage(page) {
        if (!pages[page]) {
            console.error(`Router: unknown page "${page}"`);
            return;
        }
        if (page === _currentPage) return;

        const outgoingKey = _currentPage;
        const outgoingEl = outgoingKey ? document.getElementById(pages[outgoingKey]) : null;
        const incomingEl = document.getElementById(pages[page]);

        // stop outgoing page's script (kills animations, listeners, intervals)
        if (outgoingKey && modules[outgoingKey]?.stop) {
            modules[outgoingKey].stop();
        }

        if (outgoingEl) {
            outgoingEl.classList.remove('active');
        }

        // let the fade-out finish before showing the new page
        // (skip this timeout if you don't want transitions)
        setTimeout(() => {
            if (incomingEl) incomingEl.classList.add('active');
            _currentPage = page;
            if (modules[page]?.start) modules[page].start();
        }, outgoingEl ? 250 : 0);
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