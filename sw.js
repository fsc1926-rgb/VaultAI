const CACHE_NAME = 'vaultai-forensic-v1';

// File statici essenziali da memorizzare subito
const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  // Librerie esterne usate nell'app
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/exif-js'
];

// Installazione: Crea la cache e salva i file base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app files');
      return cache.addAll(APP_FILES);
    })
  );
  self.skipWaiting();
});

// Attivazione: Pulisce le vecchie cache se si aggiorna la versione
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch: Strategia "Stale-While-Revalidate" (Offline-first dinamico)
// Tesseract scarica dinamicamente i modelli della lingua (ita.traineddata).
// Questa strategia intercetta tutto e lo salva in cache per l'uso offline futuro.
self.addEventListener('fetch', (event) => {
  // Ignora le richieste non-GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Ritorna la copia in cache se esiste
      if (cachedResponse) {
        // In background, prova comunque ad aggiornare la cache se c'è connessione
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {}); // Ignora l'errore se si è offline
        
        return cachedResponse;
      }
      
      // Se non è in cache, scaricalo dalla rete e salvalo per la prossima volta
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
