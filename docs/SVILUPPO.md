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

**Tabelle usate:** `recipes`, `ingredients`, `steps`, `user_ingredients`, `weekly_plans`, `plan_slots`, `profiles`, `api_costs`, `push_subscriptions`, `timer_notifications`. **Bucket storage:** `recipe-photos`.

Attiva la **Row Level Security** su tutte le tabelle. Lo schema del database non è ancora versionato in questo repository.

**Edge function** (`supabase/functions/`):

| Funzione | Cosa fa | Accesso |
|---|---|---|
| `import-url` | Legge una pagina web ed estrae la ricetta con Claude | utente loggato |
| `ocr-recipe` | OCR di una foto (Google Vision) + estrazione con Claude | utente loggato |
| `nome-generico-ingredienti` | Normalizza i nomi degli ingredienti con Claude | utente loggato |
| `send-due-notifications` | Invia le push dei timer scaduti e svuota il cestino | cron, con header `x-cron-secret` |

Le funzioni che consumano crediti verificano il token di sessione dell'utente: la chiave pubblica da sola non basta.

Segreti da impostare (mai nel repository):

```bash
npx supabase secrets set ANTHROPIC_API_KEY=... GOOGLE_VISION_API_KEY=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=... \
  ALLOWED_ORIGIN=https://il-tuo-sito.netlify.app
npx supabase functions deploy
```

`ALLOWED_ORIGIN` è facoltativo ma consigliato. `send-due-notifications` va chiamata ogni minuto da un cron esterno (per esempio cron-job.org) con l'header `x-cron-secret`.

La chiave VAPID **pubblica** è anche in `src/lib/push.js` (è pubblica per design): se generi nuove chiavi, aggiorna entrambe.

## Pubblicare il sito

Con Netlify CLI, dalla cartella del progetto:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

In alternativa collega il repository a Netlify per aggiornare il sito a ogni push: in quel caso imposta le due variabili `VITE_SUPABASE_*` anche nelle *Environment variables* di Netlify.

In Supabase, **Authentication → URL Configuration**, imposta l'indirizzo del sito come *Site URL* e tra i *Redirect URLs*.

## Se l'app è solo per te e la tua famiglia

Le registrazioni sono aperte e le importazioni con l'intelligenza artificiale consumano crediti API. Se non vuoi che sconosciuti possano creare un account, disattiva le nuove iscrizioni in Supabase (**Authentication → Sign In / Providers → Allow new users to sign up**), dopo aver creato gli account che ti servono.
