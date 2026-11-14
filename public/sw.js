// =============================================================================
//  OFFLINE CACHE (service worker)
// =============================================================================
//  After the first visit, the site opens even with no internet:
//   * pages (HTML): network first, cached copy when offline
//   * everything else on this site (scripts, data, images, and the AI search
//     model once it has been used): cache first, then network, and kept
//  Nothing from other websites is touched. A new CACHE name drops old copies.
// =============================================================================
const CACHE = 'microflamma-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res
    }).catch(() => caches.match('./index.html')))
    return
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
    return res
  })))
})
