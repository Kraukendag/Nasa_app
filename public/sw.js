// =============================================================================
//  OFFLINE CACHE (service worker)
// =============================================================================
//  After the first visit, the site opens even with no internet:
//   * pages (HTML) and data (JSON): network first, cached copy only when
//     offline. Data changes with every update, so a kept copy must never win
//     over the live one (an old tests.json once blanked the Pipeline page).
//   * scripts, styles, images: cache first. Their file names change when
//     their content does, so a kept copy is always the right one.
//   * The AI model caches itself (transformers.js).
//  Nothing from other websites is touched. A new CACHE name drops old copies.
// =============================================================================
const CACHE = 'microflamma-v3'

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
  if (/\.json$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    }).catch(() => caches.match(req, { ignoreSearch: true })))
    return
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
    return res
  })))
})
