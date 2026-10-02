/* ================================================================
   NOTIFICATION SYSTEM  →  window.Notify
   Callable from any page, any script, at any time.

   Usage:
     Notify.small("Saved!");                     // toast, auto-dismiss ~2.5s
     Notify.small("Copied to clipboard", 1500);   // custom duration (ms)

     Notify.big("Connection lost", "Could not reach the server. Retrying..."); 
     Notify.big("Error", "Something went wrong.", { buttonText: "Reload", onClose: () => location.reload() });

     Notify.closeBig(); // manually close a big notification from code
================================================================= */
(function () {
    // ---------- Lazy DOM lookups ----------
    // Elements are queried on first use, not at script-load time, since this
    // script may run before the toast/modal markup exists in the DOM.
    let toastEl, toastTextEl;
    let overlayEl, modalTitleEl, modalTextEl, modalButtonEl;
    let incidentEl, incidentIdEl, copyButtonEl, reportLinkEl;
    let modalButtonBound = false;
    let incidentActionsBound = false;

    function getToastEls() {
        if (!toastEl) toastEl = document.getElementById('notification-toast');
        if (!toastTextEl) toastTextEl = document.getElementById('notification-toast-text');
        return toastEl && toastTextEl;
    }

    function getModalEls() {
        if (!overlayEl) overlayEl = document.getElementById('notification-modal-overlay');
        if (!modalTitleEl) modalTitleEl = document.getElementById('notification-modal-title');
        if (!modalTextEl) modalTextEl = document.getElementById('notification-modal-text');
        if (!modalButtonEl) modalButtonEl = document.getElementById('notification-modal-button');
        if (!incidentEl) incidentEl = document.getElementById('notification-modal-incident');
        if (!incidentIdEl) incidentIdEl = document.getElementById('notification-modal-incident-id');
        if (!copyButtonEl) copyButtonEl = document.getElementById('notification-modal-copy');
        if (!reportLinkEl) reportLinkEl = document.getElementById('notification-modal-report');

        if (modalButtonEl && !modalButtonBound) {
            modalButtonEl.addEventListener('click', closeBig);
            modalButtonBound = true;
        }

        if (copyButtonEl && !incidentActionsBound) {
            copyButtonEl.addEventListener('click', copyIncidentId);
            incidentActionsBound = true;
        }

        return overlayEl && modalTitleEl && modalTextEl && modalButtonEl;
    }

    // ---------- TOAST (small) ----------
    let toastTimer = null;
    let toastLeaveTimer = null;

    function small(text, duration = 2500) {
        if (!getToastEls()) {
            console.warn('Notify: #notification-toast not found in DOM');
            return;
        }

        // Reset any in-flight timers/animations so rapid calls don't overlap
        clearTimeout(toastTimer);
        clearTimeout(toastLeaveTimer);
        toastEl.classList.remove('leaving');
        toastEl.hidden = false;

        toastTextEl.textContent = text;

        // Force reflow so re-triggering the transition works if already visible
        void toastEl.offsetWidth;
        toastEl.classList.add('visible');

        toastTimer = setTimeout(() => {
            toastEl.classList.add('leaving');
            toastEl.classList.remove('visible');
            toastLeaveTimer = setTimeout(() => {
                toastEl.hidden = true;
                toastEl.classList.remove('leaving');
            }, 250); // matches CSS transition duration
        }, duration);
    }

    // ---------- MODAL (big, blocking) ----------
    let currentOnClose = null;

    async function copyIncidentId() {
        const id = incidentIdEl?.textContent;
        if (!id) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(id);
            } else {
                const input = document.createElement('textarea');
                input.value = id;
                input.setAttribute('readonly', '');
                input.style.position = 'fixed';
                input.style.opacity = '0';
                document.body.appendChild(input);
                input.select();
                const copied = document.execCommand('copy');
                input.remove();
                if (!copied) throw new Error('Clipboard copy was not available');
            }
            copyButtonEl.textContent = 'Copied';
            setTimeout(() => { if (copyButtonEl) copyButtonEl.textContent = 'Copy ID'; }, 1600);
        } catch {
            copyButtonEl.textContent = 'Select ID above';
            setTimeout(() => { if (copyButtonEl) copyButtonEl.textContent = 'Copy ID'; }, 2000);
        }
    }

    function big(title, text, options = {}) {
        if (!getModalEls()) {
            console.warn('Notify: #notification-modal-overlay not found in DOM');
            return;
        }

        const {
            buttonText = 'OK',
            onClose = null,
            dismissible = true, // set false to hide the button for a truly locked error state
            incidentId = null,
            reportUrl = null,
        } = options;

        modalTitleEl.textContent = title;
        modalTextEl.textContent = text;
        modalButtonEl.textContent = buttonText;
        modalButtonEl.hidden = !dismissible;
        if (incidentEl) incidentEl.hidden = !incidentId;
        if (incidentIdEl) incidentIdEl.textContent = incidentId || '';
        if (copyButtonEl) copyButtonEl.textContent = 'Copy ID';
        if (reportLinkEl) {
            let safeReportUrl = null;
            try {
                if (typeof reportUrl === 'string') safeReportUrl = new URL(reportUrl, location.href);
            } catch {
                safeReportUrl = null;
            }
            const validReportUrl = safeReportUrl && safeReportUrl.protocol === 'https:' && safeReportUrl.hostname === 'github.com';
            reportLinkEl.hidden = !incidentId || !validReportUrl;
            if (validReportUrl) reportLinkEl.href = safeReportUrl.href;
            else reportLinkEl.removeAttribute('href');
        }

        currentOnClose = onClose;

        overlayEl.hidden = false;
        document.body.classList.add('notification-frozen');

        void overlayEl.offsetWidth;
        overlayEl.classList.add('visible');
    }

    function closeBig() {
        if (!overlayEl || overlayEl.hidden) return;

        overlayEl.classList.remove('visible');
        document.body.classList.remove('notification-frozen');

        setTimeout(() => {
            overlayEl.hidden = true;
        }, 220); // matches CSS transition duration

        if (typeof currentOnClose === 'function') {
            currentOnClose();
        }
        currentOnClose = null;
    }

    // ---------- Public API ----------
    window.Notify = {
        small,
        big,
        closeBig
    };
})();