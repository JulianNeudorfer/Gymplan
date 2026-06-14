// ─────────────────────────────────────────────────────────────
// APP_VERSION – diese Zahl bei jedem Update um 1 erhöhen
// z.B. nächstes Update: APP_VERSION = 3, danach 4, usw.
// ─────────────────────────────────────────────────────────────
const APP_VERSION = 5;

const CACHE_NAME = 'gymplan-v' + APP_VERSION;
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        // If Google Fonts fails (offline), continue anyway
        return cache.addAll(['/index.html', '/manifest.json']);
      });
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
// NEU: erkennt ob ein altes Cache existiert (= Update) und benachrichtigt die App
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      const oldKeys = keys.filter(k => k !== CACHE_NAME);
      const isUpdate = oldKeys.length > 0; // true = es gab eine ältere Version

      return Promise.all(oldKeys.map(k => caches.delete(k))).then(() => {
        // NEU: Update-Benachrichtigung an alle offenen Fenster/Tabs schicken
        if (isUpdate) {
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
              clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
            });
        }
      });
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful GET requests
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
