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
    let modalButtonBound = false;

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

        if (modalButtonEl && !modalButtonBound) {
            modalButtonEl.addEventListener('click', closeBig);
            modalButtonBound = true;
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

    function big(title, text, options = {}) {
        if (!getModalEls()) {
            console.warn('Notify: #notification-modal-overlay not found in DOM');
            return;
        }

        const {
            buttonText = 'OK',
            onClose = null,
            dismissible = true // set false to hide the button for a truly locked error state
        } = options;

        modalTitleEl.textContent = title;
        modalTextEl.textContent = text;
        modalButtonEl.textContent = buttonText;
        modalButtonEl.hidden = !dismissible;

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