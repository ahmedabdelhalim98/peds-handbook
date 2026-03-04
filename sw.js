const CACHE_NAME = "pwa-pro-1772655214";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./.nojekyll",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k===CACHE_NAME?null:caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith((async()=>{
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE_NAME);
        c.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || new Response("Offline", {status:200});
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const c = await caches.open(CACHE_NAME);
      c.put(req, fresh.clone());
      return fresh;
    } catch {
      return cached || new Response("", {status:504});
    }
  })());
});
