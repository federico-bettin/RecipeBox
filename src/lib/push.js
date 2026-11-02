import { supabase } from './supabase'

// Chiave pubblica VAPID — è pubblica per design (serve al browser per verificare
// che le notifiche arrivino davvero dal nostro server), non è un segreto.
const VAPID_PUBLIC_KEY = 'BGFf2LNKNF5XJwQHIAh4IwlAPB9gt-r4kkTkbImZyWssSZpF9_dWp2C5WD9tr63nBOqi_mFhM6qZD_KLazaIAZE'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// Registra il service worker (se non già attivo). Va chiamata una volta
// all'avvio dell'app.
export async function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (e) {
    console.warn('Registrazione service worker fallita:', e)
    return null
  }
}

// Richiede il permesso di notifica e crea la sottoscrizione push, salvandola
// su Supabase. Va chiamata solo quando l'utente avvia il primo timer (non
// all'apertura dell'app), per non chiedere il permesso "a freddo".
// Ritorna true se la sottoscrizione è pronta, false altrimenti.
export async function assicuraSottoscrizionePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push non supportato su questo browser/dispositivo.')
    return false
  }

  if (Notification.permission === 'denied') return false

  if (Notification.permission !== 'granted') {
    const risposta = await Notification.requestPermission()
    if (risposta !== 'granted') return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const json = subscription.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: 'endpoint' })

    return true
  } catch (e) {
    console.warn('Sottoscrizione push fallita:', e)
    return false
  }
}

// Programma una notifica push per un timer che sta partendo ORA, con durata
// in secondi. Ritorna l'id della riga creata (serve per poterla annullare se
// il timer viene chiuso/fermato prima della scadenza).
export async function programmaNotificaTimer({ titolo, corpo, secondi }) {
  const ok = await assicuraSottoscrizionePush()
  if (!ok) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dueAt = new Date(Date.now() + secondi * 1000).toISOString()
  const { data, error } = await supabase.from('timer_notifications')
    .insert({ user_id: user.id, titolo, corpo, due_at: dueAt, stato: 'in_attesa' })
    .select('id')
    .single()

  if (error) { console.warn('Programmazione notifica timer fallita:', error); return null }
  return data.id
}

// Annulla una notifica programmata (es. l'utente ha chiuso il timer prima
// della scadenza, o il countdown è già suonato mentre l'app era in primo
// piano — evitiamo così una notifica push duplicata).
export async function annullaNotificaTimer(notificaId) {
  if (!notificaId) return
  try {
    await supabase.from('timer_notifications').update({ stato: 'annullato' }).eq('id', notificaId)
  } catch (e) {
    console.warn('Annullamento notifica timer fallito:', e)
  }
}
