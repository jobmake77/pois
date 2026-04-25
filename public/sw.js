const CACHE_NAME = "pois-art-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/pois-logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetchAndCache(event.request).catch(() => caches.match("/") ?? Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetchAndCache(event.request).catch(() => caches.match("/") ?? Response.error());
    })
  );
});

function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (!response || response.status !== 200) {
      return response;
    }

    const cloned = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
    return response;
  });
}
