const page = document.getElementById('policy-page');
const title = document.getElementById('policy-title');
const status = document.getElementById('policy-status');
const content = document.getElementById('policy-content');

async function loadPolicy() {
    const key = page?.dataset.policyKey;
    const fallbackTitle = page?.dataset.policyTitle;
    if (!key || !fallbackTitle || !title || !status || !content) {
        console.error('legal-policy: page markup is incomplete');
        return;
    }

    try {
        const { middlewareGet } = await import('./data/middleware.js');
        const row = await middlewareGet('general-data', key);
        if (!row?.value) {
            status.textContent = 'Policy content is not available right now.';
            return;
        }

        const value = typeof row.value === 'string' ? { body: row.value } : row.value;
        if (!value || typeof value !== 'object' || typeof value.body !== 'string' || !value.body.trim()) {
            status.textContent = 'Policy content is not available right now.';
            return;
        }

        title.textContent = typeof value.title === 'string' && value.title.trim()
            ? value.title
            : fallbackTitle;
        document.title = `${title.textContent} | Apex Arena`;
        content.innerHTML = value.body;
        status.hidden = true;
    } catch (error) {
        console.error(`legal-policy: failed to fetch "${key}"`, error);
        status.textContent = 'Could not load this policy. Please try again later.';
    }
}

loadPolicy();
