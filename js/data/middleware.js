/**
 * Apex Arena — Middleware Client
 * ---------------------------------
 * Single source of truth for talking to the Apex Arena middleware server
 * (Render + Turso), replacing direct Supabase calls. Anything that reads
 * or writes general-data, logs, or future tables should import from here
 * rather than hardcoding the server URL elsewhere.
 *
 * Auth: not wired up yet - all calls below use public (unauthenticated)
 * actions only, matching what's currently enabled server-side:
 *   general-data: read = public, write = apiKey, delete = adminKey
 *   logs:         write = public
 * so only reads on general-data and writes on logs work from here right
 * now. Once you're ready to write to general-data from the client, add
 * CLIENT_API_KEY below and pass it via the `apiKey` option (see
 * middlewareWrite jsdoc).
 */

const MIDDLEWARE_URL = 'https://apex-arena-database-server.onrender.com';

function headers(extra = {}) {
  return {
    ...extra,
  };
}

/**
 * GET a single row from a table by its key.
 *
 *   await middlewareGet('general-data', 'game_version')
 *   // -> { id, name: 'game_version', value: 'V1.0.1' }
 *
 * Returns undefined (not an error) if the row doesn't exist (404).
 * Throws on any other failure (network, 401, 405, 503, etc).
 */
export async function middlewareGet(table, key) {
  const url = `${MIDDLEWARE_URL}/data/${table}/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: headers() });

  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`Middleware GET ${table}/${key} failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * List/filter rows from a table.
 *
 *   await middlewareList('general-data')
 *   await middlewareList('general-data', { name: 'game_version' })
 *   await middlewareList('logs', {}, 50) // limit
 *
 * Returns { table, count, rows }. Throws on failure.
 */
export async function middlewareList(table, filters = {}, limit) {
  const params = new URLSearchParams(filters);
  if (limit) params.set('limit', limit);
  const qs = params.toString();

  const url = `${MIDDLEWARE_URL}/data/${table}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    throw new Error(`Middleware LIST ${table} failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Write (upsert) a row into a table.
 *
 *   await middlewareWrite('logs', { event: 'player_joined', player: 'abc' })
 *   await middlewareWrite('general-data', { name: 'game_version', value: 'V1.0.2' }, { apiKey: '...' })
 *
 * `data` shape depends on the table:
 *   - normal tables (e.g. general-data): pass { keyColumn: ..., otherCol: ... }
 *   - wrapBodyAs tables (e.g. logs): pass whatever arbitrary JSON you want
 *     stored - the whole object becomes the row's data column.
 *
 * Pass { apiKey: '...' } once client-side auth is turned on for a table;
 * omit it for public writes (e.g. logs, right now).
 */
export async function middlewareWrite(table, data, { apiKey } = {}) {
  const url = `${MIDDLEWARE_URL}/data/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers({
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    }),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Middleware WRITE to "${table}" failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Delete a row by key. Needs adminKey on general-data right now, so this
 * will 401/503 unless you pass one - included for completeness.
 */
export async function middlewareDelete(table, key, { apiKey, adminKey } = {}) {
  const url = `${MIDDLEWARE_URL}/data/${table}/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers({
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...(adminKey ? { 'x-admin-key': adminKey } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Middleware DELETE ${table}/${key} failed (HTTP ${res.status})`);
  }
  return res.json();
}

/** Exposed for modules that need to build a custom fetch call not covered above. */
export { MIDDLEWARE_URL, headers as middlewareHeaders };