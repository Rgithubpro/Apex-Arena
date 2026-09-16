Router.register('welcome', (() => {

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ============================================================
       STATE
       ============================================================ */
    let currentStep = 'log-in';
    let getAssetFn = null; // set in start() once cache.js is loaded

    const DEV_RETURNING_KEY = 'apex-arena-dev-returning';

    /* SIMULATED ACCOUNT STATE (no backend yet)
       --------------------------------------------------------------
       Flip this constant to test the "first time" vs "returning
       user" branches of the flow. Delete this single line (and the
       two tiny helper functions right below it) once real auth
       exists and this can be derived from an actual session. */
    const DEV_SIMULATE_RETURNING_USER = false;

    function getDevReturning() {
        return DEV_SIMULATE_RETURNING_USER;
    }

    /* ============================================================
       ELEMENTS — looked up lazily on first use. Every element here
       is expected to already exist in the static HTML; nothing in
       this file appends new elements to <body> or anywhere outside
       #welcome-screen.
       ============================================================ */
    let els = null;
    function E() {
        if (els) return els;
        els = {
            screen: document.getElementById('welcome-screen'),
            canvas: document.getElementById('networkCanvas'),

            logIn: document.getElementById('welcome-screen-log-in'),
            service: document.getElementById('welcome-screen-service'),
            emailStep: document.getElementById('welcome-screen-email-step'),
            email: document.getElementById('welcome-screen-email'),
            guestSignup: document.getElementById('welcome-screen-guest-signup'),
            disclaimer: document.getElementById('welcome-screen-disclaimer'),
            welcomeBack: document.getElementById('welcome-screen-welcome-back'),
            cookies: document.getElementById('welcome-screen-cookies'),

            btnGoogle: document.getElementById('welcome-screen-login-option-google'),
            btnMicrosoft: document.getElementById('welcome-screen-login-option-microsoft'),
            btnApple: document.getElementById('welcome-screen-login-option-apple'),
            btnEmail: document.getElementById('welcome-screen-login-option-email'),
            btnGuest: document.getElementById('welcome-screen-guest-button'),

            serviceBack: document.getElementById('welcome-screen-service-back'),
            serviceTitle: document.getElementById('welcome-screen-service-title'),
            serviceSubtitle: document.getElementById('welcome-screen-service-subtitle'),

            emailBack: document.getElementById('welcome-screen-email-back'),
            cornerToSignup: document.getElementById('welcome-screen-email-teaser-to-signup'),
            cornerToLogin: document.getElementById('welcome-screen-email-teaser-to-login'),

            loginForm: document.getElementById('welcome-screen-email-login-form'),
            loginEmail: document.getElementById('welcome-screen-email-login-email'),
            loginPassword: document.getElementById('welcome-screen-email-login-password'),
            loginShowPw: document.getElementById('welcome-screen-email-login-show-password'),
            loginButton: document.getElementById('welcome-screen-email-login-button'),
            loginForgot: document.getElementById('welcome-screen-email-login-forgot'),

            signupForm: document.getElementById('welcome-screen-email-signup-form'),
            signupUsername: document.getElementById('welcome-screen-email-signup-username'),
            signupEmail: document.getElementById('welcome-screen-email-signup-email'),
            signupPassword: document.getElementById('welcome-screen-email-signup-password'),
            signupShowPw: document.getElementById('welcome-screen-email-signup-show-password'),
            signupConfirmPassword: document.getElementById('welcome-screen-email-signup-confirm-password'),
            signupShowPwConfirm: document.getElementById('welcome-screen-email-signup-show-password-confirm'),
            signupButton: document.getElementById('welcome-screen-email-signup-button'),
            strengthMeter: document.getElementById('welcome-screen-email-signup-strength-meter'),
            strengthLabel: document.getElementById('welcome-screen-email-signup-strength-label'),

            guestBackArrow: document.getElementById('welcome-screen-guest-back-arrow'),
            guestUsername: document.getElementById('welcome-screen-guest-signup-username'),
            guestBack: document.getElementById('welcome-screen-guest-signup-back-button'),
            guestContinue: document.getElementById('welcome-screen-guest-signup-continue-button'),

            disclaimerBack: document.getElementById('welcome-screen-disclaimer-back'),
            disclaimerCheckbox: document.getElementById('welcome-screen-disclaimer-accept'),
            disclaimerButton: document.getElementById('welcome-screen-disclaimer-button'),
            termsLink: document.getElementById('welcome-screen-terms-link'),
            privacyLink: document.getElementById('welcome-screen-privacy-link'),

            welcomeBackBack: document.getElementById('welcome-screen-welcome-back-back'),
            welcomeBackTitle: document.getElementById('welcome-screen-welcome-back-title'),
            welcomeBackButton: document.getElementById('welcome-screen-welcome-back-button'),

            cookiesAccept: document.getElementById('welcome-screen-cookies-button'),
            cookiesDecline: document.getElementById('welcome-screen-cookies-decline-button'),
            cookiesLinkText: document.getElementById('welcome-screen-cookies-link-text'),

            policyOverlay: document.getElementById('welcome-screen-policy-overlay'),
            policyTitle: document.getElementById('welcome-screen-policy-title'),
            policyBody: document.getElementById('welcome-screen-policy-body'),
            policyClose: document.getElementById('welcome-screen-policy-close'),
        };
        return els;
    }

    /* ============================================================
       STEP TRANSITIONS
       ============================================================ */
    function stepElement(step) {
        const e = E();
        return {
            'log-in': e.logIn,
            'service': e.service,
            'email': e.emailStep,
            'guest-signup': e.guestSignup,
            'disclaimer': e.disclaimer,
            'welcome-back': e.welcomeBack,
        }[step];
    }

    function allStepElements() {
        const e = E();
        return [e.logIn, e.service, e.emailStep, e.guestSignup, e.disclaimer, e.welcomeBack];
    }

    function goToStep(step) {
        const from = stepElement(currentStep);
        const to = stepElement(step);
        if (!to) return;
        if (from === to) return;

        if (from) {
            from.classList.add('ws-leaving');
            from.classList.remove('ws-active');
            setTimeout(() => from.classList.remove('ws-leaving'), 380);
        }
        // Force reflow so the entering transition always plays even
        // if the element was already mid-transition.
        void to.offsetWidth;
        to.classList.add('ws-active');

        currentStep = step;
    }

    /* ============================================================
       COOKIES GATE
       ============================================================ */
    const COOKIE_KEY = 'apex-arena-cookie-choice';

    function initCookies() {
        const { cookies, cookiesAccept, cookiesDecline, cookiesLinkText } = E();

        const existing = localStorage.getItem(COOKIE_KEY);
        if (!existing) {
            cookies.classList.add('ws-active');
        }

        cookiesAccept?.addEventListener('click', () => {
            localStorage.setItem(COOKIE_KEY, 'accepted');
            cookies.classList.remove('ws-active');
        });
        cookiesDecline?.addEventListener('click', () => {
            localStorage.setItem(COOKIE_KEY, 'declined');
            cookies.classList.remove('ws-active');
        });
        cookiesLinkText?.addEventListener('click', () => openPolicy('cookies'));
    }

    /* ============================================================
       POLICY POPUP (ToS / Privacy / Cookies) — the overlay markup is
       static (in index.html); this only swaps text and toggles the
       active class, so nothing gets appended to <body>.
       ============================================================ */
    const POLICY_KEYS = {
        terms: 'terms_of_service',
        privacy: 'privacy_policy',
        cookies: 'cookie_policy',
    };

    const POLICY_CONTENT = {
        terms: {
            title: 'Terms of Service',
            body: `
                <h4>1. Acceptance of terms</h4>
                <p>Placeholder copy — this text will be pulled from the database once the policy content pipeline is wired up. By playing Apex Arena you agree to these terms, which cover fair play, account ownership, and how in-game items work.</p>
                <h4>2. Accounts</h4>
                <p>Placeholder copy describing account creation, guest accounts, and what happens when a guest account is later linked to an e-mail or social login.</p>
                <h4>3. Acceptable use</h4>
                <p>Placeholder copy about cheating, exploiting, harassment, and other things that get an account suspended.</p>
                <h4>4. Changes to these terms</h4>
                <p>Placeholder copy about how and when these terms might change, and how players are notified.</p>
                <h4>5. Contact</h4>
                <p>Placeholder copy with contact details for questions about these terms.</p>
            `,
        },
        privacy: {
            title: 'Privacy Policy',
            body: `
                <h4>1. What we collect</h4>
                <p>Placeholder copy — this text will be pulled from the database. Covers gameplay data, device info, and account details tied to your login method.</p>
                <h4>2. How we use it</h4>
                <p>Placeholder copy about matchmaking, progress saving, and anti-cheat.</p>
                <h4>3. Sharing</h4>
                <p>Placeholder copy about third-party services used for login (Google, Microsoft, Apple) and hosting.</p>
                <h4>4. Your choices</h4>
                <p>Placeholder copy about data export, deletion, and cookie preferences.</p>
            `,
        },
        cookies: {
            title: 'Cookie Policy',
            body: `
                <h4>1. Why we use cookies</h4>
                <p>Placeholder copy — this text will be pulled from the database. Covers keeping you logged in and remembering basic preferences.</p>
                <h4>2. Types of cookies</h4>
                <p>Placeholder copy distinguishing essential cookies from optional analytics cookies.</p>
                <h4>3. Managing cookies</h4>
                <p>Placeholder copy about changing your choice later from settings.</p>
            `,
        },
    };

    let policiesLoaded = false;

    async function loadPolicies() {
        if (policiesLoaded) return;

        const app_base_url = new URL('./', document.baseURI);
        const { middlewareGet } = await import(new URL('js/data/middleware.js', app_base_url).href);
        const policyEntries = await Promise.all(Object.entries(POLICY_KEYS).map(async ([type, key]) => {
            const row = await middlewareGet('general-data', key);
            if (!row?.value) return [type, null];

            const value = typeof row.value === 'string' ? { body: row.value } : row.value;
            return [type, {
                title: value.title || POLICY_CONTENT[type].title,
                body: value.body || '',
            }];
        }));

        for (const [type, content] of policyEntries) {
            if (content?.body) POLICY_CONTENT[type] = content;
        }
        policiesLoaded = true;
    }

    function openPolicy(key) {
        const content = POLICY_CONTENT[key];
        if (!content) return;
        const { policyOverlay, policyTitle, policyBody } = E();
        policyTitle.textContent = content.title;
        policyBody.innerHTML = content.body;
        policyBody.scrollTop = 0;
        policyOverlay.classList.add('ws-active');
    }
    function closePolicy() {
        E().policyOverlay?.classList.remove('ws-active');
    }

    function initPolicyOverlay() {
        const { policyOverlay, policyClose } = E();
        policyClose?.addEventListener('click', closePolicy);
        policyOverlay?.addEventListener('click', (ev) => {
            if (ev.target === policyOverlay) closePolicy();
        });
    }

    /* ============================================================
       LOG-IN CHOICE — service buttons, e-mail, guest
       ============================================================ */
    function initLogInChoice() {
        const { btnGoogle, btnMicrosoft, btnApple, btnEmail, btnGuest } = E();

        btnGoogle?.addEventListener('click', () => startServiceLogin('Google'));
        btnMicrosoft?.addEventListener('click', () => startServiceLogin('Microsoft'));
        btnApple?.addEventListener('click', () => startServiceLogin('Apple'));

        btnEmail?.addEventListener('click', () => {
            goToStep('email');
        });

        btnGuest?.addEventListener('click', () => {
            goToStep('guest-signup');
        });
    }

    /* ============================================================
       SERVICE LOGIN STEP  (Google / Microsoft / Apple)
       ============================================================ */
    function initServiceStep() {
        E().serviceBack?.addEventListener('click', () => goToStep('log-in'));
    }

    async function startServiceLogin(providerName) {
        const { serviceTitle, serviceSubtitle } = E();
        goToStep('service');

        if (serviceTitle) serviceTitle.textContent = `Connecting to ${providerName}…`;
        if (serviceSubtitle) serviceSubtitle.textContent = 'This is a placeholder — real sign-in will happen here once the backend is connected.';

        // Simulated round trip to the auth provider / our backend.
        await sleep(1100);

        const returning = getDevReturning();
        if (serviceTitle) serviceTitle.textContent = returning ? 'Welcome back!' : 'Account connected';
        if (serviceSubtitle) serviceSubtitle.textContent = returning
            ? 'Taking you back into Apex Arena'
            : 'Just one more step before you jump in';

        await sleep(500);

        if (returning) {
            prepareWelcomeBack(providerName);
            goToStep('welcome-back');
        } else {
            goToStep('disclaimer');
        }
    }

    /* ============================================================
       E-MAIL LOGIN / SIGNUP — diagonal split card
       ============================================================ */
    function setEmailMode(mode) {
        E().email.dataset.mode = mode;
    }

    function initEmailCard() {
        const { emailBack, cornerToSignup, cornerToLogin } = E();

        emailBack?.addEventListener('click', () => goToStep('log-in'));

        cornerToSignup?.addEventListener('click', () => setEmailMode('signup'));
        cornerToLogin?.addEventListener('click', () => setEmailMode('login'));
    }

    function wireShowPassword(button, input) {
        if (!button || !input) return;
        const img = button.querySelector('img');

        button.addEventListener('click', async () => {
            const showing = input.type === 'text';
            const nextShowing = !showing;
            input.type = nextShowing ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(nextShowing));

            if (!img) return;
            // Cross-fade to the matching icon (show-password.png /
            // hide-password.png) via the asset cache engine, rather
            // than a plain <img src=...> swap, so it stays consistent
            // with how every other icon on this page is resolved.
            const path = nextShowing
                ? 'assets/icons/general/hide-password.png'
                : 'assets/icons/general/show-password.png';

            img.classList.add('ws-icon-swapping');
            try {
                const url = getAssetFn ? await getAssetFn(path) : path;
                await sleep(140); // let the fade-out finish before swapping the source
                img.src = url;
            } catch (err) {
                console.warn('show-password icon swap failed', err);
            } finally {
                img.classList.remove('ws-icon-swapping');
            }
        });
    }

    function addHint(afterEl) {
        const hint = document.createElement('p');
        hint.className = 'ws-field-hint';
        afterEl.insertAdjacentElement('afterend', hint);
        return hint;
    }

    function setHint(hintEl, state, text) {
        hintEl.classList.remove('ws-hint-checking', 'ws-hint-ok', 'ws-hint-bad');
        if (state) hintEl.classList.add(`ws-hint-${state}`);
        hintEl.textContent = text || '';
    }

    /* ---------- Validators (client-side pre-check; real checks
       happen server-side once the backend exists) ---------- */
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

    function scorePasswordStrength(pw) {
        if (!pw) return 0;
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 10) score++;
        return Math.min(score, 4);
    }
    const STRENGTH_LABELS = ['', 'Weak', 'Okay', 'Good', 'Strong'];

    function initLoginValidation() {
        const { loginEmail, loginPassword, loginShowPw, loginButton, loginForm, loginForgot } = E();

        wireShowPassword(loginShowPw, loginPassword);

        const emailHint = addHint(loginEmail.closest('.ws-input-wrap'));

        loginEmail.addEventListener('input', () => {
            const val = loginEmail.value.trim();
            if (!val) {
                loginEmail.classList.remove('ws-valid', 'ws-invalid');
                setHint(emailHint, null, '');
                return;
            }
            const ok = EMAIL_RE.test(val);
            loginEmail.classList.toggle('ws-valid', ok);
            loginEmail.classList.toggle('ws-invalid', !ok);
            setHint(emailHint, ok ? 'ok' : 'bad', ok ? '' : 'Enter a valid e-mail address');
        });

        loginForgot?.addEventListener('click', (ev) => {
            ev.preventDefault();
            // Placeholder — wire to a real "reset password" flow later.
            window.Notify?.small?.('Password reset isn\u2019t hooked up yet — coming soon.', 2200);
        });

        loginForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            if (loginButton.classList.contains('ws-btn-working')) return;

            const emailOk = EMAIL_RE.test(loginEmail.value.trim());
            if (!emailOk) {
                loginEmail.classList.add('ws-invalid');
                setHint(emailHint, 'bad', 'Enter a valid e-mail address');
                return;
            }

            loginButton.classList.add('ws-btn-working');
            loginButton.disabled = true;
            await sleep(900); // placeholder for real auth call

            loginButton.classList.remove('ws-btn-working');
            loginButton.disabled = false;

            // E-mail login is always the "coming back" branch per the flow.
            prepareWelcomeBack(loginEmail.value.trim());
            goToStep('welcome-back');
        });
    }

    function initSignupValidation() {
        const {
            signupUsername, signupEmail, signupPassword, signupConfirmPassword,
            signupShowPw, signupShowPwConfirm, signupButton, signupForm,
            strengthMeter, strengthLabel,
        } = E();

        wireShowPassword(signupShowPw, signupPassword);
        wireShowPassword(signupShowPwConfirm, signupConfirmPassword);

        const usernameHint = addHint(signupUsername.closest('.ws-input-wrap'));
        const emailHint = addHint(signupEmail.closest('.ws-input-wrap'));
        const confirmHint = addHint(signupConfirmPassword.closest('.ws-input-wrap'));

        // Username — debounced fake "availability check"
        let usernameCheckToken = 0;
        signupUsername.addEventListener('input', () => {
            const val = signupUsername.value.trim();
            usernameCheckToken++;
            const myToken = usernameCheckToken;

            if (!val) {
                signupUsername.classList.remove('ws-valid', 'ws-invalid');
                setHint(usernameHint, null, '');
                return;
            }
            if (!USERNAME_RE.test(val)) {
                signupUsername.classList.add('ws-invalid');
                signupUsername.classList.remove('ws-valid');
                setHint(usernameHint, 'bad', '3–16 characters: letters, numbers, underscore');
                return;
            }
            signupUsername.classList.remove('ws-invalid', 'ws-valid');
            setHint(usernameHint, 'checking', 'Checking availability…');

            setTimeout(async () => {
                if (myToken !== usernameCheckToken) return; // stale
                await sleep(500);
                if (myToken !== usernameCheckToken) return;
                // Placeholder rule: pretend "admin"/"guest" are taken.
                const taken = ['admin', 'guest', 'apexarena'].includes(val.toLowerCase());
                signupUsername.classList.toggle('ws-valid', !taken);
                signupUsername.classList.toggle('ws-invalid', taken);
                setHint(usernameHint, taken ? 'bad' : 'ok', taken ? 'Username is taken' : 'Username is available');
            }, 250);
        });

        // E-mail — debounced fake "already registered" check
        let emailCheckToken = 0;
        signupEmail.addEventListener('input', () => {
            const val = signupEmail.value.trim();
            emailCheckToken++;
            const myToken = emailCheckToken;

            if (!val) {
                signupEmail.classList.remove('ws-valid', 'ws-invalid');
                setHint(emailHint, null, '');
                return;
            }
            if (!EMAIL_RE.test(val)) {
                signupEmail.classList.add('ws-invalid');
                signupEmail.classList.remove('ws-valid');
                setHint(emailHint, 'bad', 'Enter a valid e-mail address');
                return;
            }
            signupEmail.classList.remove('ws-invalid', 'ws-valid');
            setHint(emailHint, 'checking', 'Checking…');

            setTimeout(async () => {
                if (myToken !== emailCheckToken) return;
                await sleep(500);
                if (myToken !== emailCheckToken) return;
                const taken = val.toLowerCase() === 'test@apexarena.com';
                signupEmail.classList.toggle('ws-valid', !taken);
                signupEmail.classList.toggle('ws-invalid', taken);
                setHint(emailHint, taken ? 'bad' : 'ok', taken ? 'An account already uses this e-mail' : '');
            }, 250);
        });

        // Password strength
        signupPassword.addEventListener('input', () => {
            const score = scorePasswordStrength(signupPassword.value);
            strengthMeter.dataset.strength = String(score);
            strengthLabel.textContent = signupPassword.value ? STRENGTH_LABELS[score] : '';
            checkConfirmMatch();
        });

        function checkConfirmMatch() {
            const val = signupConfirmPassword.value;
            if (!val) {
                signupConfirmPassword.classList.remove('ws-valid', 'ws-invalid');
                setHint(confirmHint, null, '');
                return;
            }
            const match = val === signupPassword.value;
            signupConfirmPassword.classList.toggle('ws-valid', match);
            signupConfirmPassword.classList.toggle('ws-invalid', !match);
            setHint(confirmHint, match ? 'ok' : 'bad', match ? '' : 'Passwords don\u2019t match');
        }
        signupConfirmPassword.addEventListener('input', checkConfirmMatch);

        signupForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            if (signupButton.classList.contains('ws-btn-working')) return;

            const usernameOk = USERNAME_RE.test(signupUsername.value.trim());
            const emailOk = EMAIL_RE.test(signupEmail.value.trim());
            const pwScore = scorePasswordStrength(signupPassword.value);
            const matchOk = signupPassword.value === signupConfirmPassword.value && signupPassword.value.length > 0;

            if (!usernameOk) { setHint(usernameHint, 'bad', '3–16 characters: letters, numbers, underscore'); signupUsername.classList.add('ws-invalid'); }
            if (!emailOk) { setHint(emailHint, 'bad', 'Enter a valid e-mail address'); signupEmail.classList.add('ws-invalid'); }
            if (!matchOk) { setHint(confirmHint, 'bad', 'Passwords don\u2019t match'); signupConfirmPassword.classList.add('ws-invalid'); }
            if (!usernameOk || !emailOk || !matchOk || pwScore < 2) {
                if (pwScore < 2) strengthLabel.textContent = 'Choose a stronger password';
                return;
            }

            signupButton.classList.add('ws-btn-working');
            signupButton.disabled = true;
            await sleep(900); // placeholder for real signup call

            signupButton.classList.remove('ws-btn-working');
            signupButton.disabled = false;

            // Signup is always the "first time" branch → ToS.
            goToStep('disclaimer');
        });
    }

    /* ============================================================
       GUEST SIGNUP
       ============================================================ */
    function initGuestSignup() {
        const { guestBackArrow, guestBack, guestContinue } = E();

        guestBackArrow?.addEventListener('click', () => goToStep('log-in'));
        guestBack?.addEventListener('click', () => goToStep('log-in'));

        guestContinue?.addEventListener('click', async () => {
            if (guestContinue.classList.contains('ws-btn-working')) return;
            guestContinue.classList.add('ws-btn-working');
            guestContinue.disabled = true;
            await sleep(600); // placeholder for guest session creation
            guestContinue.classList.remove('ws-btn-working');
            guestContinue.disabled = false;

            // Guest always goes through the disclaimer ("Always" arrow).
            goToStep('disclaimer');
        });
    }

    /* ============================================================
       DISCLAIMER (ToS accept) — first-time path
       ============================================================ */
    function initDisclaimer() {
        const { disclaimerBack, disclaimerCheckbox, disclaimerButton, termsLink, privacyLink } = E();

        disclaimerBack?.addEventListener('click', () => goToStep('log-in'));

        disclaimerButton.disabled = true;
        disclaimerCheckbox?.addEventListener('change', () => {
            disclaimerButton.disabled = !disclaimerCheckbox.checked;
        });

        termsLink?.addEventListener('click', () => openPolicy('terms'));
        privacyLink?.addEventListener('click', () => openPolicy('privacy'));

        disclaimerButton?.addEventListener('click', async () => {
            if (!disclaimerCheckbox.checked || disclaimerButton.classList.contains('ws-btn-working')) return;
            disclaimerButton.classList.add('ws-btn-working');
            await sleep(500); // placeholder for account finalization
            disclaimerButton.classList.remove('ws-btn-working');
            enterHome();
        });
    }

    /* ============================================================
       WELCOME BACK — returning path
       ============================================================ */
    function prepareWelcomeBack(identity) {
        const { welcomeBackTitle } = E();
        if (welcomeBackTitle) {
            welcomeBackTitle.textContent = identity
                ? `Welcome back, ${identity}!`
                : 'Welcome back!';
        }
    }

    function initWelcomeBack() {
        const { welcomeBackBack, welcomeBackButton } = E();

        welcomeBackBack?.addEventListener('click', () => goToStep('log-in'));

        welcomeBackButton?.addEventListener('click', async () => {
            if (welcomeBackButton.classList.contains('ws-btn-working')) return;
            welcomeBackButton.classList.add('ws-btn-working');
            await sleep(400);
            welcomeBackButton.classList.remove('ws-btn-working');
            enterHome();
        });
    }

    /* ============================================================
       HAND-OFF TO HOME
       ============================================================ */
    function enterHome() {
        window.Router?.go?.('home');
    }

    /* ============================================================
       BACKGROUND CANVAS — subtle animated network of connected
       points behind the cards, matching the starfield feel of the
       loading screen without competing with it.
       ============================================================ */
    let canvasCtx = null;
    let canvasAnimId = null;
    let canvasPoints = [];
    let canvasResizeHandler = null;

    function initNetworkCanvas() {
        const { canvas } = E();
        if (!canvas) return;
        canvasCtx = canvas.getContext('2d');

        function resize() {
            canvas.width = canvas.clientWidth * devicePixelRatio;
            canvas.height = canvas.clientHeight * devicePixelRatio;
            const count = Math.round((canvas.clientWidth * canvas.clientHeight) / 16000);
            canvasPoints = Array.from({ length: Math.min(count, 110) }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
                vy: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
            }));
        }
        resize();
        canvasResizeHandler = resize;
        window.addEventListener('resize', canvasResizeHandler);

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        function frame() {
            if (!canvasCtx) return;
            const w = canvas.width, h = canvas.height;
            canvasCtx.clearRect(0, 0, w, h);

            for (const p of canvasPoints) {
                if (!prefersReducedMotion) {
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < 0 || p.x > w) p.vx *= -1;
                    if (p.y < 0 || p.y > h) p.vy *= -1;
                }
            }

            const maxDist = 150 * devicePixelRatio;
            for (let i = 0; i < canvasPoints.length; i++) {
                for (let j = i + 1; j < canvasPoints.length; j++) {
                    const a = canvasPoints[i], b = canvasPoints[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < maxDist) {
                        canvasCtx.strokeStyle = `rgba(10, 204, 238, ${0.22 * (1 - dist / maxDist)})`;
                        canvasCtx.lineWidth = 1;
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(a.x, a.y);
                        canvasCtx.lineTo(b.x, b.y);
                        canvasCtx.stroke();
                    }
                }
            }
            for (const p of canvasPoints) {
                canvasCtx.fillStyle = 'rgba(10, 204, 238, 0.85)';
                canvasCtx.beginPath();
                canvasCtx.arc(p.x, p.y, 1.8 * devicePixelRatio, 0, Math.PI * 2);
                canvasCtx.fill();
            }

            canvasAnimId = requestAnimationFrame(frame);
        }
        frame();
    }

    function stopNetworkCanvas() {
        if (canvasAnimId) cancelAnimationFrame(canvasAnimId);
        canvasAnimId = null;
        if (canvasResizeHandler) window.removeEventListener('resize', canvasResizeHandler);
        canvasResizeHandler = null;
        canvasCtx = null;
        canvasPoints = [];
    }

    /* ============================================================
       LIFECYCLE
       ============================================================ */
    let initialized = false;

    return {
        async start() {
            const app_base_url = new URL('./', document.baseURI);
            const { syncAssets, applyAssetAttributes, getAsset, IS_DEV } = await import(new URL('js/data/cache.js', app_base_url).href);
            getAssetFn = getAsset;
            const result = await syncAssets({ onProgress: (pct, detail) => {} });
            if (result.status === 'failed') {
                console.warn('welcome: asset sync failed', result);
            }
            await applyAssetAttributes(); // fills every [data-asset] element now in the DOM for this page

            try {
                await loadPolicies();
            } catch (err) {
                console.warn('welcome: policy fetch failed; using fallback content', err);
            }

            if (!initialized) {
                initLogInChoice();
                initServiceStep();
                initEmailCard();
                initLoginValidation();
                initSignupValidation();
                initGuestSignup();
                initDisclaimer();
                initWelcomeBack();
                initCookies();
                initPolicyOverlay();
                initialized = true;
            }

            // Reset to the root step each time this page is entered,
            // but leave the e-mail card's login/signup mode exactly
            // as the user left it — only default it to "login" the
            // very first time this page is ever initialized, so a
            // later back-and-forth doesn't snap it back to login.
            currentStep = 'log-in';
            allStepElements().forEach(el => el?.classList.remove('ws-active', 'ws-leaving'));
            E().logIn?.classList.add('ws-active');
            if (!E().email.dataset.mode) {
                setEmailMode('login');
            }

            initNetworkCanvas();

            if (IS_DEV) {
                window.Notify?.small?.('Dev mode: assets are loaded directly from the sibling assets folder, not the Cache API.', 2000);
            }
        },
        stop() {
            stopNetworkCanvas();
        },
    };
})());