(function () {
    const pages = {
        'loading': 'loading-screen',
        'welcome': 'welcome-screen',
        'home': 'home-screen',
        'profile': 'profile-screen',
        'trophieroad': 'trophieroad-screen',
        'settings': 'settings-screen',
        'shop': 'shop-screen',
        'battlers': 'battlers-screen',
        'battler': 'battler-screen',
        'unlock-battler': 'unlock-battler-screen',
        'battlepass': 'battlepass-screen',
        'quests': 'quests-screen',
        'events': 'events-screen',
        'matchmaking': 'matchmaking-screen',
        'match': 'match-screen',
        'match-results': 'match-results-screen',
        'news': 'news-screen',
        'friends': 'friends-screen',
        'friend-profile': 'friend-profile-screen',
        'club': 'club-screen'
    };

    const allowedTransitions = {
        'initial': ['loading'],
        'loading': ['welcome', 'home'],
        'welcome': ['home'],
        'home': ['profile', 'trophieroad', 'settings', 'shop', 'battlers', 'battler', 'unlock-battler', 'battlepass', 'quests', 'events', 'matchmaking', 'news', 'friends', 'friend-profile', 'club'],
        'profile': ['home'],
        'trophieroad': ['home'],
        'settings': ['home'],
        'shop': ['home'],
        'battlers': ['home', 'battler', 'unlock-battler'],
        'battler': ['battlers', 'home'],
        'unlock-battler': ['battlers', 'home'],
        'battlepass': ['home', 'quests'],
        'quests': ['home', 'battlepass'],
        'events': ['home'],
        'matchmaking': ['home', 'match'],
        'match': ['match-results'],
        'match-results': ['home'],
        'news': ['home'],
        'friends': ['home', 'friend-profile'],
        'friend-profile': ['friends', 'home'],
        'club': ['home']
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