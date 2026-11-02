// Service Worker dell'app: unisce la cache offline (Workbox, generata da
// vite-plugin-pwa con la strategia injectManifest) e le notifiche push dei
// timer di cottura. È un unico file: due service worker sullo stesso scope
// si sovrascriverebbero a vicenda.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data
  try { data = event.data ? event.data.json() : {} } catch { data = {} }

  const titolo = data.titolo || 'Timer scaduto'
  const opzioni = {
    body: data.corpo || 'Il tuo timer di cottura è scaduto.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 400],
    tag: data.tag || 'timer-cottura',
    requireInteraction: true,
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(titolo, opzioni))
})

// Al tap sulla notifica, apre (o porta in primo piano) l'app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
