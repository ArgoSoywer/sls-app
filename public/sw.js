const CACHE_NAME = "sls-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const pathname = new URL(request.url).pathname;
  const isStaticAsset = ["script", "style", "font", "image"].includes(request.destination)
    || pathname.startsWith("/_next/static/");
  event.respondWith(
    (async () => {
      if (isStaticAsset) {
        const cachedAsset = await caches.match(request);
        if (cachedAsset) return cachedAsset;
      }
      try {
        const response = await fetch(request);
        if (response.ok && (request.mode === "navigate" || isStaticAsset || APP_SHELL.includes(pathname))) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, copy);
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw new Error(`No offline cache is available for ${request.url}.`);
      }
    })(),
  );
});
