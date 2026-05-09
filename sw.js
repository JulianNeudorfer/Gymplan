const CACHE = 'gymplan-v2';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // von Claude übernommen (Google Fonts caching)
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(ASSETS).catch(() =>
        // Fallback wie bei Claude verbessert
        c.addAll(['/index.html', '/manifest.json'])
      )
    )
  );
  // BLEIBT wie bei dir (kein auto skipWaiting)
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(res => {
          if (e.request.method === 'GET' && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => {
          // 👇 WICHTIGE Verbesserung von Claude:
          if (cached) return cached;

          // Offline fallback für Seiten
          if (e.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });

      return cached || network;
    })
  );
});

// bleibt von dir (Update-Flow kontrolliert)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
