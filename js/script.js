// Hide parts i dont want to see currently
const loading_screen = document.getElementById('loading-screen');
loading_screen.style.display = "none";
const welcome_screen = document.getElementById('welcome-screen');
welcome_screen.style.display = "visible";






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