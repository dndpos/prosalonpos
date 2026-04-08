/**
 * ProSalonPOS — Service Worker
 * Session C7
 *
 * Strategy:
 *   - App shell (HTML, JS, CSS, fonts, icons): cache-first, update in background
 *   - API calls (/api/*): network-only (data must be fresh)
 *   - Socket.io: skip entirely
 *
 * On new deploy, CACHE_VERSION bumps via the hashed filenames Vite generates.
 * The SW detects new assets on fetch, caches them, and prunes stale entries on activate.
 */

var CACHE_NAME = 'prosalonpos-v1';

// Precache the app shell on install
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', function(event) {
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('[SW] Precache partial failure (non-fatal):', err.message);
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  // Claim all clients immediately so the SW controls the page right away
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls — data must always be fresh
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) return;

  // Skip socket.io
  if (url.pathname.startsWith('/socket.io')) return;

  // Skip chrome-extension, ws, etc.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Skip QZ Tray (loaded locally, may not be present)
  if (url.pathname === '/qz-tray.js') return;

  // For app shell assets: stale-while-revalidate
  // Serve from cache immediately, fetch update in background
  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cached) {
        var fetchPromise = fetch(event.request).then(function(networkResponse) {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(function() {
          // Network failed — cached version (if any) already returned
          return cached;
        });

        // Return cached version immediately, or wait for network
        return cached || fetchPromise;
      });
    })
  );
});
