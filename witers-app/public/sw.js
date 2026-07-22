// Minimal service worker — its only job is to satisfy the browser's PWA
// installability requirement (a registered SW with a fetch handler) and to
// give the site's static, content-hashed assets a cache-first speed boost.
// It deliberately does NOT cache HTML navigations: pages are
// server-rendered per request (auth state, live data), so caching them
// would risk serving a stale or wrong-user shell. Hashed asset filenames
// change on every deploy, so cache-first for those never goes stale.
const CACHE_NAME = "witers-static-v1";
const CACHEABLE_PATH_RE = /^\/(assets|icons)\//;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !CACHEABLE_PATH_RE.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});
