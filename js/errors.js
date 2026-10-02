import { middlewareWrite } from './data/middleware.js';

const SCHEMA_VERSION = 1;
const MAX_REPORT_BYTES = 32 * 1024;
const MAX_BREADCRUMBS = 30;
const MAX_CONSOLE_ENTRIES = 50;
const MAX_CONSOLE_IN_REPORT = 20;
const MAX_REPORTS_PER_MINUTE = 10;
const GITHUB_REPORT_URL = 'https://github.com/Rgithubpro/Apex-Arena/issues/new';

const breadcrumbs = [];
const consoleEntries = [];
const seenErrors = new WeakMap();
const recentFingerprints = new Map();
const recentIncidentTimes = [];
const nativeConsole = {};
let appContext = {};
let sessionId = createId();

function createId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return `incident-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function redact(text) {
  return String(text)
    .replace(/([?&](?:token|access_token|api_key|key|password|secret|auth)=)[^&#\s]*/gi, '$1[redacted]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[redacted]')
    .replace(/\b(api[_-]?key|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]');
}

function truncate(value, max = 1200) {
  const safe = redact(value);
  return safe.length > max ? `${safe.slice(0, max)}…[truncated]` : safe;
}

function safeValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return truncate(value, 800);
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return `[Function${value.name ? ` ${value.name}` : ''}]`;
  if (typeof value !== 'object') return truncate(String(value), 300);
  if (typeof Node !== 'undefined' && value instanceof Node) {
    return `[DOM ${value.nodeName || value.constructor?.name || 'Node'}]`;
  }
  if (depth >= 3) return `[${value.constructor?.name || 'Object'}]`;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (value instanceof Error) return normalizeError(value);
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => safeValue(item, depth + 1, seen));
  const result = {};
  for (const key of Object.keys(value).slice(0, 20)) {
    if (/authorization|cookie|password|secret|token|api.?key/i.test(key)) {
      result[key] = '[redacted]';
    } else {
      try { result[key] = safeValue(value[key], depth + 1, seen); } catch { result[key] = '[Unreadable]'; }
    }
  }
  return result;
}

function normalizeError(error, location = {}) {
  if (error instanceof Error) {
    return {
      name: truncate(error.name || 'Error', 100),
      message: truncate(error.message || String(error), 3000),
      stack: truncate(error.stack || '', 8000),
      cause: error.cause === undefined ? undefined : (error.cause === error ? '[Circular]' : safeValue(error.cause)),
      ...location,
    };
  }
  return {
    name: 'NonErrorRejection',
    message: truncate(typeof error === 'string' ? error : safeValue(error) === undefined ? 'Unknown error' : JSON.stringify(safeValue(error)), 3000),
    ...location,
  };
}

function safePageUrl() {
  try {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return location.origin;
  }
}

function addBreadcrumb(event, details = {}) {
  try {
    breadcrumbs.push({
      timestamp: new Date().toISOString(),
      event: truncate(event, 120),
      details: safeValue(details),
    });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.splice(0, breadcrumbs.length - MAX_BREADCRUMBS);
  } catch {
    // Breadcrumbs are best-effort and must never interfere with application code.
  }
}

function installConsoleCapture() {
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    nativeConsole[level] = original;
    console[level] = (...args) => {
      try {
        consoleEntries.push({
          timestamp: new Date().toISOString(),
          level,
          args: args.slice(0, 6).map((arg) => safeValue(arg)),
        });
        if (consoleEntries.length > MAX_CONSOLE_ENTRIES) consoleEntries.shift();
      } catch {
        // Preserve console behavior even if an unusual value cannot be serialized.
      }
      return original(...args);
    };
  }
}

function makePayload({ incidentId, event, severity, error, context }) {
  let payload = {
    schemaVersion: SCHEMA_VERSION,
    incidentId,
    sessionId,
    event: truncate(event || 'client_error', 120),
    severity: truncate(severity || 'error', 40),
    timestamp: new Date().toISOString(),
    error: normalizeError(error),
    context: {
      app: appContext,
      ...safeValue(context || {}),
      route: window.Router?.current?.() || null,
      pageUrl: safePageUrl(),
      online: navigator.onLine,
      language: navigator.language,
      languages: Array.from(navigator.languages || []).slice(0, 5),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: truncate(navigator.userAgent, 500),
      platform: truncate(navigator.platform || '', 120),
      screen: { width: screen.width, height: screen.height, dpr: devicePixelRatio || 1 },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 },
      memory: navigator.deviceMemory || null,
      cores: navigator.hardwareConcurrency || null,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData,
      } : null,
    },
    breadcrumbs: breadcrumbs.slice(-MAX_BREADCRUMBS),
    console: consoleEntries.slice(-MAX_CONSOLE_IN_REPORT),
  };

  const serialize = () => JSON.stringify(payload);
  let json = serialize();
  while (new Blob([json]).size > MAX_REPORT_BYTES && payload.console.length) {
    payload.console.shift();
    json = serialize();
  }
  while (new Blob([json]).size > MAX_REPORT_BYTES && payload.breadcrumbs.length) {
    payload.breadcrumbs.shift();
    json = serialize();
  }
  if (new Blob([json]).size > MAX_REPORT_BYTES) {
    payload.error.stack = truncate(payload.error.stack || '', 1200);
    payload.error.message = truncate(payload.error.message || '', 1000);
    payload.error.cause = undefined;
    payload.console = [];
    payload.breadcrumbs = [];
    payload.context = safeValue({
      app: payload.context.app,
      route: payload.context.route,
      pageUrl: payload.context.pageUrl,
      feature: context || {},
    });
    json = serialize();
  }
  if (new Blob([json]).size > MAX_REPORT_BYTES) {
    payload.error.stack = '';
    payload.error.message = truncate(payload.error.message || 'Unknown error', 400);
    payload.context = {
      route: truncate(payload.context?.route || '', 120),
      pageUrl: truncate(payload.context?.pageUrl || '', 300),
      feature: '[truncated]',
    };
    json = serialize();
  }
  return payload;
}

function fingerprint(error, event) {
  const value = error instanceof Error
    ? `${error.name}:${error.message}:${(error.stack || '').split('\n')[1] || ''}`
    : String(error);
  return `${event}|${value}`.slice(0, 1200);
}

function duplicateIncidentId(error, event) {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    if (seenErrors.has(error)) return seenErrors.get(error);
  }
  const key = fingerprint(error, event);
  const now = Date.now();
  const prior = recentFingerprints.get(key);
  for (const [oldKey, record] of recentFingerprints) {
    if (now - record.time > 10_000) recentFingerprints.delete(oldKey);
  }
  return prior && now - prior.time < 10_000 ? prior.incidentId : null;
}

function withinRateLimit() {
  const now = Date.now();
  while (recentIncidentTimes.length && now - recentIncidentTimes[0] > 60_000) recentIncidentTimes.shift();
  if (recentIncidentTimes.length >= MAX_REPORTS_PER_MINUTE) return false;
  recentIncidentTimes.push(now);
  return true;
}

async function capture({ event = 'client_error', error, severity = 'error', context = {}, notify = false, title } = {}) {
  const duplicateId = duplicateIncidentId(error, event);
  if (duplicateId) {
    if (notify) showIncidentNotice(duplicateId, title);
    return duplicateId;
  }
  const incidentId = createId();
  try {
    if (error && (typeof error === 'object' || typeof error === 'function')) seenErrors.set(error, incidentId);
    recentFingerprints.set(fingerprint(error, event), { time: Date.now(), incidentId });
    addBreadcrumb('incident_captured', { event, severity });
    if (!withinRateLimit()) {
      addBreadcrumb('incident_suppressed_rate_limit', { event });
      if (notify) showIncidentNotice(null, title);
      return null;
    }

    const payload = makePayload({ incidentId, event, severity, error, context });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    middlewareWrite('logs', payload, { signal: controller.signal, keepalive: true })
      .catch((loggingError) => {
        nativeConsole.error?.('AppErrors: incident log write failed (non-fatal)', loggingError);
      })
      .finally(() => clearTimeout(timeout));
    if (notify) showIncidentNotice(incidentId, title);
  } catch (reportingError) {
    nativeConsole.error?.('AppErrors: failed to capture incident (non-fatal)', reportingError);
  }
  return incidentId;
}

function getReportUrl(incidentId) {
  return `${GITHUB_REPORT_URL}?title=${encodeURIComponent(`Bug report — ${incidentId}`)}&body=${encodeURIComponent(`Incident reference: ${incidentId}\n\nWhat happened?`)}`;
}

function showIncidentNotice(incidentId, title = 'Something went wrong') {
  try {
    window.Notify?.big(
      title,
      incidentId
        ? 'An unexpected problem occurred. You can refresh the game or include this reference ID when reporting it.'
        : 'An unexpected problem occurred. Please refresh the game and try again.',
      {
        buttonText: 'Refresh',
        onClose: () => location.reload(),
        dismissible: true,
        incidentId,
        reportUrl: getReportUrl(incidentId),
      }
    );
  } catch (err) {
    nativeConsole.error?.('AppErrors: unable to show incident notice', err);
  }
}

function setContext(context = {}) {
  appContext = { ...appContext, ...safeValue(context) };
}

function installGlobalHandlers() {
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message || 'Uncaught browser error');
    void capture({
      event: 'uncaught_error',
      error,
      context: { source: event.filename, line: event.lineno, column: event.colno },
      notify: true,
      title: 'Something went wrong',
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    void capture({
      event: 'unhandled_rejection',
      error: event.reason,
      notify: true,
      title: 'Something went wrong',
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') addBreadcrumb('tab_visible');
    else addBreadcrumb('tab_hidden');
  });
}

installConsoleCapture();
installGlobalHandlers();
addBreadcrumb('reporter_initialized', { environment: location.hostname });

window.AppErrors = Object.freeze({
  capture,
  breadcrumb: addBreadcrumb,
  setContext,
  showNotice: showIncidentNotice,
  getReportUrl,
  getSessionId: () => sessionId,
});

export { capture, addBreadcrumb as breadcrumb, setContext, showIncidentNotice, getReportUrl };
