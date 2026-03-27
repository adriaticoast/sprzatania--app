// ============================================================
//  SERVICE WORKER — Moje Sprzątania PWA
//  Strategia: Cache-first dla zasobów lokalnych,
//             Stale-While-Revalidate dla Apps Script (dane szybko + świeże)
// ============================================================
const CACHE_NAME = 'sprzatania-v2';
const API_CACHE_NAME = 'sprzatania-api-v2';

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
          return key !== CACHE_NAME && key !== API_CACHE_NAME;
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

  // Google Apps Script — Stale-While-Revalidate
  // Zwraca od razu z cache (jeśli jest), jednocześnie odświeża w tle
  if (url.includes('script.google.com')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(function(cache) {
        return cache.match(event.request.url.split('&_=')[0].split('&callback=')[0]).then(function(cached) {

          // Zawsze próbuj pobrać świeże dane w tle
          var fetchPromise = fetch(event.request).then(function(networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              // Zapisz do cache (bez parametrów czasowych)
              var cacheKey = url.split('&_=')[0].split('&callback=')[0];
              cache.put(cacheKey, networkResponse.clone());
            }
            return networkResponse;
          }).catch(function() {
            return null;
          });

          // Jeśli mamy cache — zwróć natychmiast, sieć działa w tle
          if (cached) {
            return cached;
          }

          // Brak cache — czekaj na sieć
          return fetchPromise.then(function(response) {
            if (response) return response;
            return caches.match('./offline.html');
          });
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
