// =============================================================================
//  OFFLINE CACHE (service worker)
// =============================================================================
//  After the first visit, the site opens even with no internet:
//   * pages (HTML): network first, cached copy when offline
//   * everything else on this site (scripts, data, images): cache first, then
//     network, and kept. The AI model caches itself (transformers.js).
//  Nothing from other websites is touched. A new CACHE name drops old copies.
// =============================================================================
const CACHE = 'microflamma-v2'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // The AI search model and runtime are cached by transformers.js itself; it
  // checks and cancels downloads in ways a generic cache would break.
  if (/\/(models|ort)\//.test(url.pathname)) return
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
