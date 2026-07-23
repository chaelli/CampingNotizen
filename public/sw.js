/* Minimaler Service Worker für die PWA.
 * - macht die App installierbar (Manifest + SW + HTTPS)
 * - App-Shell offline verfügbar (network-first für Navigation,
 *   stale-while-revalidate für eigene Assets)
 * - fremde Requests (Kartenkacheln, Supabase) werden NICHT angefasst
 */
const CACHE = 'cn-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Tiles/Supabase in Ruhe lassen

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put(req, net.clone())
          return net
        } catch {
          return (await caches.match(req)) || (await caches.match(self.registration.scope)) || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      const network = fetch(req)
        .then((net) => {
          caches.open(CACHE).then((c) => c.put(req, net.clone()))
          return net
        })
        .catch(() => cached)
      return cached || network
    })(),
  )
})
