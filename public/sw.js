const CACHE_NAME = 'snippt-link-v1';

// Install - just activate immediately
self.addEventListener('install', () => {
    self.skipWaiting();
});

// Activate - clean old caches and claim clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('snippt-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch - cache assets on first request, serve from cache after
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests (fonts, etc)
    if (!request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                // Return cached version, but also update cache in background
                fetch(request).then((response) => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response);
                        });
                    }
                }).catch(() => { });
                return cached;
            }

            // Not in cache - fetch and cache
            return fetch(request).then((response) => {
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                // Offline and not cached - return offline page for navigation
                if (request.mode === 'navigate') {
                    return caches.match('./');
                }
                throw new Error('Offline');
            });
        })
    );
});
