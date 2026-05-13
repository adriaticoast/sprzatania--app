// ============================================================
//  SERVICE WORKER — Moje Sprzątania PWA
//  Strategia: Cache-first dla zasobów lokalnych,
//             NETWORK-ONLY dla Apps Script (nigdy nie cachuj danych!)
// ============================================================
const CACHE_NAME = 'sprzatania-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html'
];

// ── Instalacja ───────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Aktywacja: usuń stare cache ──────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          // Usuń WSZYSTKIE stare cache łącznie z API cache ze starej wersji
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Google Apps Script — ZAWSZE sieć, nigdy cache
  // Dane muszą być świeże — cachowanie powoduje że zmiany nie są widoczne
  if (url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Offline i brak cache dla API — zwróć pustą odpowiedź JSON
        return new Response('{"workers":[],"jobs":[]}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Statyczne zasoby — Cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      return caches.match('./offline.html');
    })
  );
});
