// Peck Party service worker — stale-while-revalidate so the game loads
// instantly (and works offline), while every online visit refreshes the
// cache in the background so deployed updates actually reach devices.
// All paths are relative so it works from a GitHub Pages project subpath.

const CACHE = 'peck-party-v2';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './js/audio.js',
  './js/settings.js',
  './js/game.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    const refresh = fetch(event.request).then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    });
    if (cached) {
      // Serve stale immediately; refresh in the background for next load.
      event.waitUntil(refresh.catch(() => {}));
      return cached;
    }
    return refresh.catch(() => cached);
  })());
});
