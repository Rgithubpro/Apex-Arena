// Random pieces js for now.
const microsoft = document.getElementById('welcome-screen-login-option-microsoft');
microsoft.addEventListener('click', () => {
    alert('Microsoft login is currently unavailable. Please try again later.');
});
const show_password = document.getElementById('welcome-screen-email-login-show-password');
const show_password_icon = document.getElementById('welcome-screen-email-login-show-password-icon');
let password_visible = false;
show_password.addEventListener('click', () => {
    password_visible = !password_visible;
    if (password_visible) {
        show_password_icon.src = 'assets/images/icons/hide-password.png';
    } else {
        show_password_icon.src = 'assets/images/icons/show-password.png';
    }});


// temporary stuff to from loading to current dev page, will be removed later
function transitionFromLoading() {
    console.log('Transitioning from loading to home');
    if (window.location.hash.substring(1) === 'loading') {
        console.log('loading...')
        setTimeout(() => {
            window.location.hash = 'home';
            console.log('Transitioning from loading to home');
        }, 500);
    }
}

window.addEventListener('hashchange', transitionFromLoading);
window.addEventListener('load', transitionFromLoading);
