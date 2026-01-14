// sw.js - Service Worker para Let's Hunt (PWA)
const CACHE_VERSION = 'v1.1.0'; // Incrementa este número al actualizar recursos
const STATIC_CACHE_NAME = `letshunt-static-${CACHE_VERSION}`;

// Recursos esenciales para funcionar offline
const STATIC_ASSETS = [
  '/index.html',
  '/registro.html',
  '/app.html',
  '/progreso.html',
  '/styles.css',
  '/logo.webp',
  '/fondo-hero.webp',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  
  // Fuentes locales (si las usas)
  './fonts/exo-2-400.woff2',
  './fonts/exo-2-700.woff2',
  
  // Librerías externas (¡críticas para offline!)
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  
  // Google Fonts (corregida: sin espacios)
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800&display=swap'
];

// Instalación: cachear recursos estáticos
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando recursos esenciales');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés antiguos
self.addEventListener('activate', event => {
  console.log('[SW] Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== STATIC_CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estrategia de red + caché
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Cache-first para recursos estáticos
  if (STATIC_ASSETS.some(asset => asset === url.pathname || asset === event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // 2. Network-first para APIs o datos dinámicos (opcional)
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Por defecto: ir a red
  event.respondWith(fetch(event.request));
});