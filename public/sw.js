/* Cache only Daily Fuel's app shell.
   Never cache Supabase requests or user data. */

const BASE = '/daily-fuel/';
const CACHE = 'daily-fuel-shell-v2';

const CORE = [
  BASE,
  BASE + 'manifest.webmanifest',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('daily-fuel-shell-') && key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(BASE))
    );
    return;
  }

  if (
    url.pathname.startsWith(BASE + 'assets/') ||
    url.pathname.startsWith(BASE + 'icons/') ||
    url.pathname === BASE + 'manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();

            event.waitUntil(
              caches.open(CACHE).then(cache => cache.put(request, copy))
            );
          }

          return response;
        })
      )
    );
  }
});