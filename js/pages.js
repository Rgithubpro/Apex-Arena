// Loading screen logic in 1 function
let called_loading_screen = false
async function check_loading_screen() {
    if (window.location.hash.substring(1) === 'loading') {
        if (called_loading_screen === false) {
            called_loading_screen = true
            const { load_screen } = await import('/js/pages-functions.js');
            load_screen()
            setTimeout(() => {
                called_loading_screen = false
            }, 5000)
        }
    }
}
window.addEventListener('hashchange', check_loading_screen);
window.addEventListener('load', check_loading_screen);