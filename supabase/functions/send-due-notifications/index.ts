import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const GIORNI_CESTINO = 7

// Cancella in modo definitivo le ricette nel cestino da più di GIORNI_CESTINO
// giorni (foto comprese). Chiamata come parte dello stesso cron già attivo
// ogni minuto per le notifiche dei timer, per non dover configurare un
// secondo servizio esterno.
async function pulisciCestino(sb: any) {
  const soglia = new Date(Date.now() - GIORNI_CESTINO * 24 * 60 * 60 * 1000).toISOString()
  const { data: scadute } = await sb
    .from('recipes')
    .select('id, foto_url')
    .not('eliminata_il', 'is', null)
    .lt('eliminata_il', soglia)
    .limit(100)

  if (!scadute || scadute.length === 0) return 0

  for (const r of scadute) {
    if (r.foto_url) {
      const path = String(r.foto_url).split('/recipe-photos/')[1]
      if (path) { try { await sb.storage.from('recipe-photos').remove([path]) } catch (_) {} }
    }
  }
  const ids = scadute.map((r: any) => r.id)
  await sb.from('recipes').delete().in('id', ids)
  return ids.length
}

// Chiamata periodicamente (ogni ~1 minuto) da un cron esterno (es. cron-job.org).
// Cerca i timer scaduti non ancora inviati/annullati, spedisce la notifica push
// a tutte le sottoscrizioni dell'utente, marca la riga come "inviato" — e in più
// svuota il cestino delle ricette eliminate da più di 7 giorni.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Protezione minima: richiede un segreto condiviso nell'header, così solo il
  // nostro cron esterno può risvegliare questa funzione (evita abusi/spam).
  // Il segreto è OBBLIGATORIO: se CRON_SECRET non è configurato la funzione
  // rifiuta tutte le chiamate (così non resta mai aperta a chiunque).
  const cronSecret = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret')
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  try {
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublic || !vapidPrivate) throw new Error('Chiavi VAPID non configurate')

    webpush.setVapidDetails('mailto:noreply@ricette-pwa.local', vapidPublic, vapidPrivate)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) Svuota il cestino delle ricette scadute (indipendente dai timer sotto)
    const eliminateDefinitivamente = await pulisciCestino(sb)

    // 2) Notifiche push dei timer scaduti
    const { data: scaduti, error: errScaduti } = await sb
      .from('timer_notifications')
      .select('*')
      .eq('stato', 'in_attesa')
      .lte('due_at', new Date().toISOString())
      .limit(200)

    if (errScaduti) throw errScaduti
    if (!scaduti || scaduti.length === 0) {
      return new Response(JSON.stringify({ inviati: 0, eliminateDefinitivamente }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    let inviati = 0
    let falliti = 0

    for (const timer of scaduti) {
      const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', timer.user_id)

      if (!subs || subs.length === 0) {
        // Nessuna sottoscrizione valida per questo utente: marchiamo comunque
        // come inviato per non ritentare all'infinito.
        await sb.from('timer_notifications').update({ stato: 'inviato' }).eq('id', timer.id)
        continue
      }

      const payload = JSON.stringify({ titolo: timer.titolo, corpo: timer.corpo, tag: `timer-${timer.id}` })

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          inviati++
        } catch (e) {
          falliti++
          // 404/410 = sottoscrizione scaduta o revocata lato browser: la rimuoviamo.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            console.error('Invio push fallito per', sub.id, e)
          }
        }
      }

      await sb.from('timer_notifications').update({ stato: 'inviato' }).eq('id', timer.id)
    }

    return new Response(JSON.stringify({ inviati, falliti, totale_timer: scaduti.length, eliminateDefinitivamente }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-due-notifications error:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Errore sconosciuto' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
