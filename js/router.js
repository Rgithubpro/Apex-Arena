// router.js — load this before your other scripts
(function () {
    const pages = {
        'loading': 'loading-screen',
        'welcome': 'welcome-screen',
        'home': 'home-screen'
    }

    let _currentPage = null;

    function showPage(page) {
        if (!pages[page]) {
            console.warn(`Router: unknown page "${page}"`);
            return;
        }
        for (const key in pages) {
            document.getElementById(pages[key]).style.display = key === page ? 'block' : 'none';
        }
        _currentPage = page;
    }

    // Expose a controlled API globally
    window.Router = {
        go: showPage,
        current: () => _currentPage,
        exists: (page) => !!pages[page]
    };

    window.addEventListener('load', () => {
        window.Router.go('loading');
    });
})();