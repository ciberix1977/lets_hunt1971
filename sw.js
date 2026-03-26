/* ==========================================================================
   sw.js - Service Worker para Codigo Ebel
   Versión: 1.0.1 (Corregida)
   ========================================================================== */

const CACHE_NAME = 'codigo-ebel-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/registro.html',
  '/app.html',
  '/progreso.html',
  '/politicas.html',
  '/styles.css',
  '/code_ebel3.webp',
  '/fondo-hero.webp',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&display=swap',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-analytics.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ========== INSTALL ==========
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto:', CACHE_NAME);
        // Cachear solo recursos críticos (sin fallar si alguno no existe)
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.warn('⚠️ Recurso no cacheable:', url);
                return null;
              })
              .catch(err => {
                console.warn('⚠️ Error al cachear:', url, err);
                return null;
              });
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker instalado');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('❌ Error en install:', err);
      })
  );
});

// ========== ACTIVATE ==========
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// ========== FETCH ==========
self.addEventListener('fetch', event => {
  // Solo interceptar solicitudes del mismo origen
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            // No cachear respuestas que no sean exitosas
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clonar la respuesta para cachear
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          })
          .catch(err => {
            console.error('❌ Error en fetch:', err);
            // Offline fallback para HTML
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            return null;
          });
      })
  );
});