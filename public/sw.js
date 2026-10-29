// CogniBase service worker. It does two small things so the app costs less data and works on a weak connection:
//  1. Remembers the app's own scripts and styles (they never change for a given file name).
//  2. Remembers sources you have opened, so one you already read still opens with no signal.
// Nothing else is cached: API calls, account pages and anything personal always go to the network.
// Caches are cleared on sign-out (see lib/offline.ts), so a shared phone never shows the next person your sources.

const STATIC = 'cb-static-v1';
const PAGES = 'cb-pages-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate' && url.pathname.startsWith('/lecture-materials/')) {
    event.respondWith(networkFirst(request));
  }
});
