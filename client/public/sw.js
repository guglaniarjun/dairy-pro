const CACHE = "dairyflow-shell-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k.startsWith("dairyflow-shell-"))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
// Never cache authenticated API responses. Only the public app shell and hashed assets.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (url.pathname.startsWith("/assets/"))
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const found = await cache.match(event.request);
        if (found) return found;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }),
    );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.mode !== "navigate" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put("/app-shell", copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match("/app-shell");
        return (
          cached ||
          new Response(
            "Open DairyFlow once while online to prepare offline entry.",
            { headers: { "Content-Type": "text/plain" } },
          )
        );
      }),
  );
});
