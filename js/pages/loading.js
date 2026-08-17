Router.register('loading', (() => {
	let _running = false;
	let _titleInterval = null;

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function edit_loading_percentage(target) {
		const loading_percentage = document.getElementById('loading-screen-percentage');
		if (!loading_percentage) return;
		while (_running) {
			let current_percentage = parseFloat(loading_percentage.textContent) || 0;
			if (current_percentage >= target) break;
			loading_percentage.textContent = (current_percentage + 1) + '%';
			await sleep(8);
		}
	}

    async function edit_loading_detail(target) {
        const loading_detail = document.getElementById('loading-screen-detail');
        if (!loading_detail) return;
        loading_detail.textContent = target;
    }

	return {
		async start() {
			if (_running) return;
			_running = true;

			const loading_screen = document.getElementById('loading-screen');

			// Notification block (may short-circuit the rest)
			try {
				const { loading_notif } = await import('/js/data/database/extra.js');
				const [notifEnabled, notifTitle, notifDesc, notifTime, notifImage] = await loading_notif();
				const notif = document.getElementById('loading-screen-notification');
				const img   = document.getElementById('loading-screen-notification-img');
				if (notif && notifEnabled === true) {
					document.getElementById('loading-screen-notification-title').textContent = notifTitle || '';
					document.getElementById('loading-screen-notification-description').textContent = notifDesc || '';
					document.getElementById('loading-screen-notification-time').textContent = notifTime || '';
					if (notifImage) {
						img.src = notifImage;
						img.style.display = 'block';
					} else {
						img.removeAttribute('src');
						img.style.display = 'none';
					}
					notif.hidden = false;
					document.body.classList.add('has-notification');
					_running = false;
					return;
				} else if (notif) {
					notif.hidden = true;
					document.body.classList.remove('has-notification');
				}
			} catch (err) {
				console.error('loading: failed to load notification data', err);
			}

			const title = document.getElementById('loading-screen-title');
			const states = ['', '.', '..', '...', '..', '.'];
			let idx = 0;

			_titleInterval = setInterval(() => {
				if (title) title.textContent = 'Loading' + states[idx];
				idx = (idx + 1) % states.length;

				if (loading_screen && loading_screen.style.display === 'none') {
					clearInterval(_titleInterval);
					_titleInterval = null;
					if (title) title.textContent = 'Loading';
					_running = false;
				}
			}, 400);

			const loading_bar = document.getElementById('loading-screen-bar-fill');
            edit_loading_detail('Initializing...');

			if (loading_bar) loading_bar.style.width = '10%';
			edit_loading_percentage(10);

			// simulate loading steps
			await sleep(2000);

			if (!_running) return;
			if (loading_bar) loading_bar.style.width = '50%';
            edit_loading_detail('Loading content...');
            edit_loading_percentage(50);

			await sleep(1000);

			if (!_running) return;
			if (loading_bar) loading_bar.style.width = '100%';
            edit_loading_detail('Finalizing...');
            edit_loading_percentage(100);

			await sleep(1000);

			if (!_running) return;
			try {
				const { get_logged_in } = await import('/js/data/localstorage.js');
				if (await get_logged_in() === true) {
					Router.go('home');
				} else {
					Router.go('welcome');
				}
			} catch (err) {
				console.error('loading: failed to check login state', err);
				Router.go('welcome');
			}
		},

		stop() {
			if (_titleInterval) {
				clearInterval(_titleInterval);
				_titleInterval = null;
			}
			_running = false;
		}
	};
})());
