// Minimal service worker — makes the app installable and gives a basic
// offline shell. API calls always go to the network.
const CACHE = 'thingtracker-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // never cache API / websocket / attachments — always network
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
      return res
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  )
})
