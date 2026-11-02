// Service Worker per le notifiche push dei timer di cottura.
// Riceve gli eventi "push" inviati dalla edge function send-due-notifications
// e mostra una notifica di sistema, anche se l'app è chiusa o lo schermo spento.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }

  const titolo = data.titolo || 'Timer scaduto'
  const opzioni = {
    body: data.corpo || 'Il tuo timer di cottura è scaduto.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
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
