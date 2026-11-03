# Sviluppo e pubblicazione

[← Torna al README](../README.md) · [English version](DEVELOPMENT.md)

## Tecnologie

React 19 + Vite, React Router, Supabase (database, autenticazione, storage, edge function), vite-plugin-pwa / Workbox, Netlify per il sito.

## Avvio in locale

Servono Node.js 20 o superiore e un progetto [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env.local    # poi compila i due valori
npm run dev
```

Altri comandi: `npm run build` (build di produzione), `npm run lint`, `npm run preview`.

## Variabili d'ambiente (frontend)

| Variabile | Descrizione |
|---|---|
| `VITE_SUPABASE_URL` | URL del progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chiave pubblica del progetto (la "anon" o la "publishable key") |

Usa solo la chiave pubblica, mai la `service_role`. Il file `.env.local` non va committato (è già nel `.gitignore`).

## Backend (Supabase)

**Tabelle usate:** `recipes`, `ingredients`, `steps`, `user_ingredients`, `weekly_plans`, `plan_slots`, `profiles`, `api_costs`, `push_subscriptions`, `timer_notifications`, `recipe_provate`. **Bucket storage:** `recipe-photos`.

Lo schema completo (tabelle, Row Level Security, trigger, permessi e bucket delle foto) è in [`supabase/schema.sql`](../supabase/schema.sql): eseguilo una volta nell'SQL Editor di un progetto nuovo. Il file concede in modo esplicito i permessi sulle tabelle, perché dal 30 ottobre 2026 Supabase non lo fa più in automatico; l'accesso senza login (`anon`) resta chiuso.

**Edge function** (`supabase/functions/`):

| Funzione | Cosa fa | Accesso |
|---|---|---|
| `import-url` | Legge una pagina web ed estrae la ricetta con Claude | utente loggato, con la propria chiave Anthropic |
| `ocr-recipe` | Claude legge una foto o un PDF ed estrae la ricetta | utente loggato, con la propria chiave Anthropic |
| `nome-generico-ingredienti` | Normalizza i nomi degli ingredienti con Claude | utente loggato, con la propria chiave Anthropic |
| `send-due-notifications` | Invia le push dei timer scaduti e svuota il cestino | cron, con header `x-cron-secret` |

Le funzioni che consumano crediti verificano il token di sessione dell'utente: la chiave pubblica da sola non basta.

Segreti da impostare (mai nel repository):

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=... \
  ALLOWED_ORIGIN=https://il-tuo-sito.netlify.app
npx supabase functions deploy
```

`ALLOWED_ORIGIN` è facoltativo ma consigliato. `send-due-notifications` va chiamata ogni minuto da un cron esterno (per esempio cron-job.org) con l'header `x-cron-secret`.

Le chiavi VAPID (per le notifiche dei timer) si generano con `npx web-push generate-vapid-keys`. La chiave **pubblica** va anche in `src/lib/push.js`, nella costante `VAPID_PUBLIC_KEY` (è pubblica per design): se usi un tuo progetto, sostituisci quella che c'è con la tua, altrimenti le notifiche non funzionano.

## Intelligenza artificiale: ognuno usa la propria chiave

Importare ricette da link, foto e PDF usa Claude e ha un costo, che paga chi lo usa. L'app **non ha una chiave Anthropic sul server**: l'utente incolla la propria nel Profilo e l'app la invia a ogni importazione nell'header `x-anthropic-key`. La funzione la usa solo per quella richiesta, non la salva né la scrive nei log. Senza chiave la funzione risponde `403 CHIAVE_ANTHROPIC_MANCANTE` e l'app spiega all'utente cosa fare; il resto dell'app funziona.

Non serve quindi nessun segreto `ANTHROPIC_API_KEY` su Supabase. Se ne avevi uno impostato, puoi toglierlo: `npx supabase secrets unset ANTHROPIC_API_KEY GOOGLE_VISION_API_KEY`.

## Ricette di base e ricette personali

- Le ricette con `is_pubblica = true` sono la **base**: leggibili da tutti gli utenti loggati, modificabili solo da chi le ha create.
- Le ricette che gli utenti aggiungono sono **personali** (`is_pubblica = false`).
- Un utente **non può** rendere pubblica una ricetta: un trigger (`blocca_pubblicazione`) lo impedisce. Solo l'amministratore, dall'SQL Editor di Supabase o con la chiave `service_role`, può farlo:

```sql
update public.recipes set is_pubblica = true where id = 'ID-DELLA-RICETTA';
```

- "Già provata" è per utente, nella tabella `recipe_provate`.
- Le ricette pubbliche nel cestino non sono visibili agli altri utenti.

Se hai già un progetto creato con una versione precedente, applica la migrazione [`supabase/migrations/20261103000000_ricette_base_e_personali.sql`](../supabase/migrations/20261103000000_ricette_base_e_personali.sql) nell'SQL Editor. **Prima di pubblicare l'app nuova** esegui la migrazione: copia anche i segni "già provata" esistenti nella nuova tabella.

## Pubblicare il sito

Con Netlify CLI, dalla cartella del progetto:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

In alternativa collega il repository a Netlify per aggiornare il sito a ogni push: in quel caso imposta le due variabili `VITE_SUPABASE_*` anche nelle *Environment variables* di Netlify.

In Supabase, **Authentication → URL Configuration**, imposta l'indirizzo del sito come *Site URL* e tra i *Redirect URLs*.

## Registrazioni

Chiunque può registrarsi: le ricette di ognuno sono personali e l'AI usa la chiave di chi la importa, quindi un utente in più non costa nulla a chi gestisce l'app. Se vuoi limitare le iscrizioni (per esempio a una famiglia), disattiva le nuove registrazioni in Supabase: **Authentication → Sign In / Providers → Allow new users to sign up**.
