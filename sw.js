// ============================================================
//  SERVICE WORKER — Moje Sprzątania PWA
//  Strategia: Cache-first dla zasobów lokalnych,
//             Network-first dla Apps Script (dane na żywo)
// ============================================================

const CACHE_NAME = 'sprzatania-v1';

// Zasoby lokalne do cache'owania przy instalacji
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html'
];

// ── Instalacja: zapisz statyczne zasoby ──────────────────────
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
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key)   { return caches.delete(key);  })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: strategia według URL ──────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Żądania do Google Apps Script — Network-first
  // (dane muszą być świeże; jeśli brak sieci → strona offline)
  if (url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(function() {
          return caches.match('./offline.html');
        })
    );
    return;
  }

  // Wszystko inne — Cache-first (zasoby lokalne)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        // Zapisz nowe zasoby do cache
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
