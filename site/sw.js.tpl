/* Ave service worker. The build replaces __VERSION__ with a hash of the shell files. */
const VERSION = "__VERSION__";
const SHELL = ["./", "index.html", "app.css", "paper.css", "i18n.js", "aloud.js", "app.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "about.html", "about-es.html", "data/days.json", "data/companion.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open("shell-" + VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("shell-") && k !== "shell-" + VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Readings and fonts: network first, keep a copy for offline use.
  if (url.pathname.includes("/data/") || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open("data").then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== location.origin) return;
  // AI voice pieces: never precached. Each URL names one fixed recording, so keep
  // the ones already heard (newest 300) and play them from here next time, offline too.
  if (url.pathname === "/api/voice") {
    e.respondWith(caches.open("voice").then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { c.put(req, res.clone()).then(() => c.keys()).then(k => Promise.all(k.slice(0, Math.max(0, k.length - 300)).map(x => c.delete(x)))).catch(() => {}); }
      return res;
    }))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
