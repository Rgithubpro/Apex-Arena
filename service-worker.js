const CACHE = 'apex-shell-v2';

// Only what the loading screen needs to boot and show a message offline.
// Other same-origin code files (js/css/json) get cached automatically after the first online visit.
const SHELL = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/router.js',
  'js/pages/loading.js',
  'js/notification.js',
  'js/errors.js',
  'js/data/middleware.js',
  'assets/fonts/LilitaOne-Regular.woff2',
  'assets/icons/apex-arena.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled: one wrong path won't make the whole install fail
    await Promise.allSettled(SHELL.map((p) => cache.add(p)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('apex-shell-') && k !== CACHE) // never touches cache.js's cache
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // CDN, database server, game server: untouched

  const isNav = req.mode === 'navigate';
  if (!isNav && !/\.(js|css|json|html)$/.test(url.pathname)) return; // assets belong to cache.js

  event.respondWith(networkFirst(req, isNav));
});

// Online: always the freshest deploy. Offline: the last cached copy.
async function networkFirst(req, isNav) {
  const cache = await caches.open(CACHE);
  const key = isNav ? 'index.html' : req;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key, { ignoreSearch: true })) || Response.error();
  }
}