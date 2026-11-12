const CACHE_NAME = 'parish-register-v2';

// Install: pre-cache manifest, icons, and offline fallback page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache
        .addAll(['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'])
        .catch(() => {})
    )
  );
  self.skipWaiting();
});

// Activate: remove old cache versions and take control of open clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: never cache /api/* or non-GET requests; serve offline.html when offline on navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;
          const cachedShell = await caches.match('/');
          return cachedShell || Response.error();
        })
    );
    return;
  }

  // Static production bundles and icons: cache-and-refresh in background
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/branding/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
