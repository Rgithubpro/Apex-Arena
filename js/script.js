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

/*
const notif = document.getElementById('loading-screen-notification');
const img   = document.getElementById('loading-screen-notification-img');

function showNotification({ title, desc, time, image }) {
    document.getElementById('loading-screen-notification-title').textContent = title;
    document.getElementById('loading-screen-notification-description').textContent = desc;
    document.getElementById('loading-screen-notification-time').textContent = time;
    if (image) {
        img.src = image;
        img.style.display = 'block';
    } else {
        img.removeAttribute('src');
        img.style.display = 'none';
    }
    notif.hidden = false;
    document.body.classList.add('has-notification');
}

function hideNotification() {
    notif.hidden = true;
    document.body.classList.remove('has-notification');
}
*/
   
