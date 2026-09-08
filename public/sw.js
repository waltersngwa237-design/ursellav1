// Ursella Progressive Web App Service Worker
const CACHE_NAME = 'ursella-app-v6';
const FONT_CACHE_NAME = 'ursella-fonts-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-maskable-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg',
  '/favicon.svg',
];

// Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Core pre-caching finished with non-fatal items:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Purge obsolete caches and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== FONT_CACHE_NAME) {
            console.log('[SW] Clearing legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Strategy:
// 1. Never cache Supabase mutations, live streams, or API routes to prevent stale business data.
// 2. Cache-First for Google Fonts (stylesheets and woff2 font files).
// 3. Stale-While-Revalidate for Vite bundles (.js, .css, images, svg, icons).
// 4. Network-First with /index.html Cache fallback for SPA page navigations.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, API endpoints, Supabase cloud queries, and hot-reloaders
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@react-refresh')
  ) {
    return;
  }

  // 1. Google Fonts Cache (Cache-First)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(FONT_CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => {
            // Return empty response rather than throwing
            return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } });
          });
      })
    );
    return;
  }

  // 2. Navigation requests (SPA routes like /#/sell, /#/inventory, /#/insights)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response(
            '<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Ursella Offline</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Ursella Business OS</h2><p>Working in offline mode. Please reconnect or reload once online.</p><button onclick="location.reload()" style="padding:10px 20px;border-radius:8px;border:none;background:#4f46e5;color:white;cursor:pointer;">Reload</button></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html' },
            }
          );
        })
    );
    return;
  }

  // 3. Static Vite JS/CSS bundles and image assets -> Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.jsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.json');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        // If cachedResponse exists, return it immediately; otherwise wait for network
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetchPromise.then((resp) => {
          if (resp) return resp;
          return new Response('Asset unavailable offline', { status: 503 });
        });
      })
    );
    return;
  }

  // 4. Default Network-First with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const match = await caches.match(event.request);
        if (match) return match;
        return new Response('Network unavailable', { status: 503 });
      })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Ursella Business Alert';
    const options = {
      body: data.body || 'You have a new operational update.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: {
        url: data.url || '/#/insights',
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Push event error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Background Sync API: Flush offline transactions when browser regains connectivity
self.addEventListener('sync', (event) => {
  if (event.tag === 'ursella-offline-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});
