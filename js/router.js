// All pages:
const pages = {
    'loading': 'loading-screen',
    'welcome': 'welcome-screen',
    'home': 'home-screen'
}
function hideAll() {
    for (const key in pages) {
        const element = document.getElementById(pages[key]);
        element.style.display = 'none';
    }
}

function showPage(page) {
    for (const key in pages) {
        const element = document.getElementById(pages[key]);
        if (key === page) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }
}
// detect on which # page the user is and show the correct page
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (pages[hash]) {
        showPage(hash);
    } else {
        showPage('loading');
    }
});
// on page load, show loading page
window.addEventListener('load', () => {
    //set window hash to #loading
    window.location.hash = 'loading';
    showPage('loading');
});