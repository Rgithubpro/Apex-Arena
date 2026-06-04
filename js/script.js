const loading_screen = document.getElementById('loading-screen');
loading_screen.style.display = "none";

const microsoft = document.getElementById('welcome-screen-login-option-microsoft');
microsoft.addEventListener('click', () => {
    alert('Microsoft login is currently unavailable. Please try again later.');
});