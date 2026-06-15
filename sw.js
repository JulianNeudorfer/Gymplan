// ─────────────────────────────────────────────────────────────
// APP_VERSION – diese Zahl bei JEDEM Update um 1 erhöhen!
// (z.B. 2 → 3 → 4 …) Nur so erkennt die App eine neue Version.
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

// Install: cache assets, sofort aktiv werden
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        return cache.addAll(['/index.html', '/manifest.json']);
      });
    })
  );
  self.skipWaiting(); // neue Version sofort übernehmen
});

// Activate: alte Caches löschen + App benachrichtigen wenn es ein Update war
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      const oldKeys = keys.filter(k => k !== CACHE_NAME);
      const wasUpdate = oldKeys.length > 0;
      return Promise.all(oldKeys.map(k => caches.delete(k))).then(() => {
        return self.clients.claim();
      }).then(() => {
        if (wasUpdate) {
          return self.clients.matchAll({ type:'window', includeUncontrolled:true })
            .then(clients => clients.forEach(c => c.postMessage({ type:'SW_UPDATED' })));
        }
      });
    })
  );
});

// Fetch-Strategie:
//  - HTML/Navigation: NETWORK FIRST (immer neueste Version, Cache nur offline)
//  - Alles andere (Fonts, Icons): CACHE FIRST (schnell)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 req.url.includes('index.html');

  if (isHTML) {
    // NETWORK FIRST für die App-Seite
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put('/index.html', clone));
        return res;
      }).catch(() => caches.match('/index.html') || caches.match(req))
    );
  } else {
    // CACHE FIRST für statische Dateien
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});

// Nachricht von der App: sofort aktivieren (für "Jetzt aktualisieren" Button)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
