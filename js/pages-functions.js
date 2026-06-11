//sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// LOADING SCREEN FUNCTIONS:
async function edit_loading_percentage(target) {
  const loading_percentage = document.getElementById('loading-screen-percentage');
  while (true) {
  let current_percentage = parseFloat(loading_percentage.textContent)
  if (current_percentage >= target) break;
  loading_percentage.textContent = current_percentage + 1 +'%';
  await sleep(10)
  }
}
export async function load_screen() {
  const loading_screen = document.getElementById('loading-screen')
  const title = document.getElementById('loading-screen-title');
  const states = ['', '.', '..', '...', '..', '.'];
  let idx = 0;

  // voorkom dubbele intervals
  if (load_screen._running) return;
  load_screen._running = true;

  const intervalId = setInterval(() => {
    title.textContent = 'Loading' + states[idx];
    idx = (idx + 1) % states.length;

    if (loading_screen.style.display === 'none') {
      clearInterval(intervalId);
      title.textContent = 'Loading';
      load_screen._running = false;
    }
  }, 400);

  const loading_bar = document.getElementById('loading-screen-bar-fill');

  loading_bar.style.width = '10%';
  edit_loading_percentage(10)
  await sleep(2000);
  loading_bar.style.width = '50%';
  edit_loading_percentage(50)
  await sleep(1000);
  loading_bar.style.width = '100%';
  edit_loading_percentage(100)
  await sleep(1000)
  // window.location.hash = 'welcome';
}