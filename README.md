# RecipeBox

App di ricette di cucina (PWA): salva le tue ricette preferite e cucinale con la guida passo passo, timer inclusi.

## Funzioni

- **Archivio ricette** con categorie (Antipasti, Primi, Secondi, Contorni, Dessert, Cocktail), diete e ricerca per ingrediente
- **Guida passo passo** con foto dei passaggi e timer di cottura
- **Notifiche push** quando un timer scade, anche con l'app chiusa
- **Importa una ricetta** da un link web, da una foto o da un file (estrazione con Claude e OCR con Google Vision)
- **Piano settimanale** dei pasti e lista della spesa
- **Cestino** con eliminazione definitiva dopo 7 giorni
- **Costi API** per utente (token Claude e richieste Vision)
- **Installabile** come app sul telefono e utilizzabile offline (PWA)

## Tecnologie

React 19 + Vite, React Router, Supabase (database, autenticazione, storage, edge function), vite-plugin-pwa / Workbox, Netlify per il deploy.

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
| `VITE_SUPABASE_ANON_KEY` | Chiave `anon` (pubblica) del progetto |

Su Netlify vanno impostate in *Site configuration → Environment variables*, altrimenti il build non funziona.

## Backend (Supabase)

**Tabelle usate:** `recipes`, `ingredients`, `steps`, `weekly_plans`, `plan_slots`, `profiles`, `api_costs`, `push_subscriptions`, `timer_notifications`. **Bucket storage:** `recipe-photos`.

Attiva la **Row Level Security** su tutte le tabelle, con policy che limitano ogni utente ai propri dati (`user_id = auth.uid()`). Lo schema non è ancora versionato in questo repository.

**Edge function** (`supabase/functions/`):

| Funzione | Cosa fa | Accesso |
|---|---|---|
| `import-url` | Legge una pagina web ed estrae la ricetta con Claude | utente loggato |
| `ocr-recipe` | OCR di una foto (Google Vision) + estrazione con Claude | utente loggato |
| `nome-generico-ingredienti` | Normalizza i nomi degli ingredienti con Claude | utente loggato |
| `send-due-notifications` | Invia le push dei timer scaduti e svuota il cestino | cron, con `x-cron-secret` |

Le funzioni che consumano crediti verificano il token di sessione dell'utente: la chiave `anon` da sola non basta.

Segreti da impostare (non vanno mai nel repository):

```bash
supabase secrets set ANTHROPIC_API_KEY=... GOOGLE_VISION_API_KEY=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=... \
  ALLOWED_ORIGIN=https://il-tuo-sito.netlify.app
supabase functions deploy import-url ocr-recipe nome-generico-ingredienti send-due-notifications
```

`ALLOWED_ORIGIN` è facoltativo ma consigliato. `send-due-notifications` va chiamata ogni minuto da un cron esterno (per esempio cron-job.org) con l'header `x-cron-secret`.

La chiave VAPID **pubblica** è anche in `src/lib/push.js` (è pubblica per design); se generi nuove chiavi aggiorna entrambe.

## Licenza

[MIT](LICENSE)
