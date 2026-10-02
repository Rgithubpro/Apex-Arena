Router.register('loading', (() => {
	let _running = false;
	let _titleInterval = null;
	const app_base_url = new URL('./', document.baseURI);
	const app_module_url = path => new URL(path, app_base_url).href;

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// ---- Connectivity gate ---------------------------------------------
	// Free Render server can cold-start slowly, so only a hard network
	// failure counts as "unreachable" - no timeout on purpose.
	// Replace with the base URL from middleware.js if it exports one.
	const SERVER_PING_URL = 'https://apex-arena-database-server.onrender.com/ping';

	async function can_reach_server() {
		if (!navigator.onLine) return false;
		try {
			// no-cors: resolves on any answer (even 4xx/5xx), rejects only on network failure
			await fetch(SERVER_PING_URL, { mode: 'no-cors', cache: 'no-store' });
			return true;
		} catch {
			return false;
		}
	}

	async function ensure_online() {
		let notified = false;
		while (_running && !(await can_reach_server())) {
			if (!notified) {
				notified = true;
				edit_loading_detail('Waiting for connection...');
				window.Notify?.big(
					"You're offline",
					"You can't play right now because you're offline. Check your internet connection - the game continues automatically once you're back online.",
					{ dismissible: false }
				);
			}
			// retry when the browser reports online, or every 5s as a fallback
			await new Promise(resolve => {
				const done = () => {
					window.removeEventListener('online', done);
					clearTimeout(timer);
					resolve();
				};
				const timer = setTimeout(done, 5000);
				window.addEventListener('online', done);
			});
		}
		if (notified) {
			window.Notify?.closeBig();
			await sleep(250); // let the modal's close transition finish before another big() can open
		}
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

	function set_loading_bar(pct) {
		const loading_bar = document.getElementById('loading-screen-bar-fill');
		if (loading_bar) loading_bar.style.width = pct + '%';
	}

	function parse_loading_notif_data(value) {
		if (Array.isArray(value)) {
			if (value.length !== 4) throw new Error('loading_notif_data must contain four values');
			return value;
		}
		if (typeof value !== 'string') {
			throw new Error('loading_notif_data must be a string or array');
		}

		const text = value.trim();
		if (text.startsWith('[')) {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed) && parsed.length === 4) return parsed;
			throw new Error('loading_notif_data must contain four values');
		}

		// general-data currently stores four single-quoted, comma-separated
		// values. Commas inside a quoted description are preserved, and SQL
		// escaped apostrophes ('') are converted back to single apostrophes.
		const values = [];
		let index = 0;
		while (index < text.length) {
			while (/\s/.test(text[index] || '')) index++;
			if (text[index] !== "'") throw new Error('Invalid loading_notif_data format');
			index++;

			let field = '';
			let closed = false;
			while (index < text.length) {
				if (text[index] === "'") {
					if (text[index + 1] === "'") {
						field += "'";
						index += 2;
					} else {
						index++;
						closed = true;
						break;
					}
				} else {
					field += text[index++];
				}
			}
			if (!closed) throw new Error('Unclosed value in loading_notif_data');
			values.push(field);

			while (/\s/.test(text[index] || '')) index++;
			if (index < text.length) {
				if (text[index] !== ',') throw new Error('Invalid loading_notif_data separator');
				index++;
			}
		}

		if (values.length !== 4) throw new Error('loading_notif_data must contain four values');
		return values;
	}

	// Shown when syncAssets() has exhausted its retries. Uses the real
	// Notify.big() modal (notification.js) rather than the bespoke
	// #loading-screen-notification block — same failure UI everywhere
	// something goes wrong, not a one-off. dismissible: false, since
	// there's nothing meaningful to dismiss INTO (assets never synced),
	// so Refresh is the only way forward.
	function show_failure_notice(reportUrl, incidentId) {
		window.Notify?.big(
			"Couldn't load game assets",
			`Please try refreshing. If this keeps happening, report it on GitHub${reportUrl ? '.' : ''}`,
			{
				buttonText: 'Refresh',
				onClose: () => location.reload(),
				dismissible: true,
				incidentId,
				reportUrl: incidentId ? window.AppErrors?.getReportUrl?.(incidentId) : reportUrl,
			}
		);
	}

	return {
		async start() {
			if (_running) return;
			_running = true;
			window.AppErrors?.breadcrumb('loading_started');

			const loading_screen = document.getElementById('loading-screen');
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

			await ensure_online();
			if (!_running) return;

			edit_loading_detail('Fetching game version...');
			set_loading_bar(1);
			edit_loading_percentage(1);

			// cache.js is a CORE file (js/data/cache.js, same-origin) — it ships
			// with the client and is the one thing that can't itself come
			// from the assets repo. Imported once here and reused for
			// every call below, rather than re-importing per use.
			const cache = await import(app_module_url('js/data/cache.js'));
			const { fetchAssetsVersion, fetchGameVersion, resolveModuleUrl, syncAssets, applyStyles, applyHTML, applyScripts, startStaleSessionGuard } = cache;

			let assetsVersion = null;
			try {
				assetsVersion = await fetchAssetsVersion();
				console.log(`GAME | Assets Version = ${assetsVersion}`);
			} catch (err) {
				console.error('loading: failed to fetch assets_version', err);
				await window.AppErrors?.capture({ event: 'assets_version_lookup_failed', error: err, severity: 'warning', context: { step: 'loading_boot' } });
			}
			let gameVersion = null;
			try {
				gameVersion = await fetchGameVersion();
				console.log(`GAME | Game Version = ${gameVersion}`);
			} catch (err) {
				console.error('loading: failed to fetch game_version', err);
				await window.AppErrors?.capture({ event: 'game_version_lookup_failed', error: err, severity: 'warning', context: { step: 'loading_boot' } });
			}
			window.AppErrors?.setContext({ gameVersion, assetsVersion, environment: location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'development' : 'production' });

			// Notification settings live in general-data and are read via the
			// core middleware client, so this works before assets are synced.
			try {
				const { middlewareGet } = await import(app_module_url('js/data/middleware.js'));
				const enabledRow = await middlewareGet('general-data', 'loading_notif_enabled');
				const notifEnabled = String(enabledRow?.value ?? '').trim().toLowerCase() === 'true';
				const notif = document.getElementById('loading-screen-notification');
				const img   = document.getElementById('loading-screen-notification-img');
				if (notif && notifEnabled) {
					const dataRow = await middlewareGet('general-data', 'loading_notif_data');
					const [notifTitle, notifDesc, notifTime, notifImage] = parse_loading_notif_data(dataRow?.value);
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
					if (_titleInterval) {
						clearInterval(_titleInterval);
						_titleInterval = null;
					}
					_running = false;
					return;
				} else if (notif) {
					notif.hidden = true;
					document.body.classList.remove('has-notification');
				}
			} catch (err) {
				console.error('loading: failed to load notification data', err);
				await window.AppErrors?.capture({ event: 'loading_notification_config_failed', error: err, severity: 'warning', context: { step: 'loading_notification' } });
			}

			edit_loading_detail('Initializing...');
			set_loading_bar(2);
			edit_loading_percentage(2);

			// --- Real asset sync ---
			// syncAssets() already retries internally (see cache.js
			// MAX_ATTEMPTS) and logs to Turso on final failure.
			// Here we just react to the result.
			let syncResult;
			window.AppErrors?.breadcrumb('asset_sync_started', { assetsVersion });
			try {
				syncResult = await syncAssets({
					assetsVersion,
					onProgress: (pct, detail) => {
						if (!_running) return;
						if (typeof pct === 'number') {
							set_loading_bar(pct);
							edit_loading_percentage(pct);
						}
						if (detail) edit_loading_detail(detail);
					},
				});
			} catch (err) {
				// Shouldn't normally happen — syncAssets() catches its own
				// errors — but guard anyway so a bug in cache.js can't hang
				// the loading screen forever.
				console.error('loading: unexpected error from syncAssets', err);
				const incidentId = await window.AppErrors?.capture({ event: 'asset_sync_unexpected_failure', error: err, context: { assetsVersion } });
				syncResult = { status: 'failed', reportUrl: 'https://github.com/Rgithubpro/Apex-Arena/issues', incidentId };
			}

			if (syncResult.status === 'failed') {
				if (_titleInterval) { clearInterval(_titleInterval); _titleInterval = null; }
				_running = false;
				show_failure_notice(syncResult.reportUrl, syncResult.incidentId);
				return;
			}
			window.AppErrors?.breadcrumb('asset_sync_completed', { assetsVersion });

			if (!_running) return;

			// --- Build pages: CSS -> HTML -> scripts, in that order. ---
			// Order matters: page scripts do document.getElementById(...)
			// at top-level registration time (not lazily inside start()),
			// so HTML must exist before scripts run; CSS goes first to
			// avoid a flash of unstyled content on the freshly-injected
			// markup. Each function handles its own per-item failures
			// internally (via Notify.big + middleware logging) and keeps
			// going rather than aborting the whole boot on one bad file.
			edit_loading_detail('Applying styles...');
			window.AppErrors?.breadcrumb('asset_styles_applying');
			set_loading_bar(96);
			edit_loading_percentage(96);
			await applyStyles();

			edit_loading_detail('Building pages...');
			window.AppErrors?.breadcrumb('asset_html_applying');
			set_loading_bar(98);
			edit_loading_percentage(98);
			await applyHTML();

			edit_loading_detail('Starting scripts...');
			window.AppErrors?.breadcrumb('asset_scripts_applying');
			set_loading_bar(99);
			edit_loading_percentage(99);
			await applyScripts();

			if (!_running) return;
			set_loading_bar(100);
			window.AppErrors?.breadcrumb('loading_completed');
			edit_loading_detail('Launching...');
			edit_loading_percentage(100);
			await sleep(500);

			if (!_running) return;

			// Start the stale-session guard once, now that a page is
			// about to show — see cache.js for why this is visibility-
			// triggered rather than a polling timer.
			startStaleSessionGuard();

			try {
				const { get_logged_in } = await import(await resolveModuleUrl('js/data/localstorage.js', assetsVersion));
				if (await get_logged_in() === true) {
					Router.go('home');
				} else {
					Router.go('welcome');
				}
			} catch (err) {
				console.error('loading: failed to check login state', err);
				await window.AppErrors?.capture({ event: 'login_state_lookup_failed', error: err, severity: 'warning', context: { assetsVersion, gameVersion } });
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