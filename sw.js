// ─────────────────────────────────────────────────────────────
// APP_VERSION – diese Zahl bei JEDEM Update um 1 erhöhen!
// (z.B. 2 → 3 → 4 …) Nur so erkennt die App eine neue Version.
// ─────────────────────────────────────────────────────────────
const APP_VERSION = 9;

const CACHE_NAME = 'gymplan-v' + APP_VERSION;
const ASSETS = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

// Install: cache assets, sofort aktiv werden
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        return cache.addAll(['index.html', 'manifest.json']);
      });
    })
  );
  self.skipWaiting(); // neue Version sofort übernehmen
});

// Activate: alte Caches löschen + App benachrichtigen wenn es ein Update war
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      const oldKeys = keys.filter(k => k !== CACHE_NAME && k !== 'gymplan-fresh');
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
    // NETWORK FIRST für die App-Seite, mit garantiertem Cache-Fallback
    e.respondWith(
      fetch(req).then(res => {
        // nur gültige Antworten cachen
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('index.html', clone));
        }
        return res;
      }).catch(async () => {
        // Offline / schlechtes Netz → gecachte Version aus IRGENDEINEM Cache holen
        const cached = await caches.match('index.html') || await caches.match('/index.html') || await caches.match(req);
        if (cached) return cached;
        // Letzter Notnagel: aus dem fresh-Cache (vom Update) holen
        const fresh = await caches.open('gymplan-fresh').then(c => c.match('index.html')).catch(() => null);
        if (fresh) return fresh;
        // Wirklich nichts da → einfache Hinweisseite statt weißem Bildschirm
        return new Response('<!DOCTYPE html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem;text-align:center"><h2>Keine Verbindung</h2><p>Bitte mit dem Internet verbinden und neu laden.</p><button onclick="location.reload()" style="padding:.6rem 1.2rem;font-size:1rem;border-radius:8px;border:1px solid #ccc;background:#f5f5f3">Neu laden</button></body>', {headers:{'Content-Type':'text/html'}});
      })
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
