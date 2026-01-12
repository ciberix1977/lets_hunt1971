// sw.js

const CACHE_VERSION = 'v1.0.0'; // ✅ Incrementa este número en cada actualización
const STATIC_CACHE_NAME = `letshunt-static-${CACHE_VERSION}`;
const PAGES_CACHE_NAME = `letshunt-pages-${CACHE_VERSION}`;

// ✅ Lista de recursos que forman el "esqueleto" de la app (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/registro.html',
  '/app.html',
  '/styles.css', // Asumiendo que moviste el CSS aquí
  '/app.js',
  '/manifest.json',
  '/logo.png',
  '/logo-lh.png',
  // Añade aquí todas las imágenes y fuentes críticas
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800&display=swap'
];

// ✅ Instalación: Guarda en caché los recursos estáticos
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cacheando app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ✅ Activación: Limpia cachés antiguos
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== STATIC_CACHE_NAME && cache !== PAGES_CACHE_NAME) {
            console.log('Service Worker: Borrando caché antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// ✅ Intercepción de peticiones: Estrategias de caché
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Estrategia 1: Cache First para recursos estáticos (CSS, JS, imágenes)
  if (STATIC_ASSETS.includes(url.pathname) || url.origin === 'https://fonts.googleapis.com') {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request);
      })
    );
    return;
  }

  // Estrategia 2: Network First para páginas HTML
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request).then(networkResponse => {
        // Si la red responde, guardamos una copia en caché
        if (networkResponse.ok) {
          return caches.open(PAGES_CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }
        // Si la red falla, intentamos desde caché
        return caches.match(request);
      }).catch(() => {
        // Si la red falla por completo, servimos desde caché
        return caches.match(request);
      })
    );
    return;
  }

  // Para cualquier otra cosa, ir a la red
  event.respondWith(fetch(request));
});