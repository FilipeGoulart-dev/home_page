const CACHE_NAME = 'dashboard-filipe-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Background images to cache
const BACKGROUND_IMAGES = [
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1920',
  'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1920',
  'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1920',
  'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=1920',
  'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=1920',
  'https://images.unsplash.com/photo-1433863448220-78aaa064ff47?w=1920',
  'https://images.unsplash.com/photo-1495344517868-8ebaf0a2044a?w=1920',
  'https://images.unsplash.com/photo-1485470733090-0aae1788d5af?w=1920',
  'https://images.unsplash.com/photo-1501691223387-dd0500403074?w=1920',
  'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1920',
  'https://images.unsplash.com/photo-1505506874110-6a7a69069a08?w=1920'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Cache background images in the background (don't block install)
        caches.open(CACHE_NAME).then(cache => {
          BACKGROUND_IMAGES.forEach(url => {
            fetch(url, { mode: 'no-cors' })
              .then(response => cache.put(url, response))
              .catch(err => console.log('[SW] Failed to cache bg:', url));
          });
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Spotify API calls (they need fresh data)
  if (url.hostname.includes('spotify.com') || url.hostname.includes('api.spotify.com')) {
    return;
  }

  // For API calls (weather), try network first, then cache
  if (url.hostname.includes('api.open-meteo.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request);
        })
    );
    return;
  }

  // For everything else, try cache first, then network
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached response and update cache in background
          fetch(request)
            .then(response => {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, response);
              });
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone and cache
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return offline fallback for HTML
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
});

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚀</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚀</text></svg>',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification('Dashboard do Filipe', options)
  );
});
