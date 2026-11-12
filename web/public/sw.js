// Offline support. The page itself is fetched fresh whenever there's a connection (so new
// deploys arrive), falling back to the saved copy offline. Built files have content hashes in
// their names, so once saved they never need fetching again.
const CACHE = 'billys-garage-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-180.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname === '/version.json') return; // always ask the network

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }

  // Page and everything else: network first, saved copy when offline.
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    if (res.ok) caches.open(CACHE).then((c) => c.put(key, copy));
    return res;
  }).catch(() => caches.match(key).then((hit) => hit || Response.error())));
});
