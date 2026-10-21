// Offline cache: the app works at the machine even without Wi-Fi.
const CACHE = 'espresso-kompass-v5';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/ui.js', 'js/engine.js', 'js/brew-data.js', 'js/cafes.js', 'js/app.js', 'js/brew-ui.js', 'js/cafes-ui.js', 'js/tickdial.js', 'js/tasting-data.js', 'js/tasting-ui.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Network first so updates arrive immediately; cache as fallback.
self.addEventListener('fetch', (e) => {
  // Only the app's own files; API calls (OpenStreetMap) go straight to the network.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
