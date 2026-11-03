# Development and deployment

[← Back to README](../README.en.md) · [Versione italiana](SVILUPPO.md)

## Stack

React 19 + Vite, React Router, Supabase (database, authentication, storage, edge functions), vite-plugin-pwa / Workbox, Netlify for hosting.

## Running locally

You need Node.js 20 or newer and a [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env.local    # then fill in the two values
npm run dev
```

Other commands: `npm run build` (production build), `npm run lint`, `npm run preview`.

## Environment variables (frontend)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | The project's public key (the "anon" or "publishable" key) |

Use the public key only, never the `service_role` key. Don't commit `.env.local` (it is already in `.gitignore`).

## Backend (Supabase)

**Tables used:** `recipes`, `ingredients`, `steps`, `user_ingredients`, `weekly_plans`, `plan_slots`, `profiles`, `api_costs`, `push_subscriptions`, `timer_notifications`. **Storage bucket:** `recipe-photos`.

Enable **Row Level Security** on every table. The database schema is not versioned in this repository yet.

**Edge functions** (`supabase/functions/`):

| Function | What it does | Access |
|---|---|---|
| `import-url` | Reads a web page and extracts the recipe with Claude | signed-in user |
| `ocr-recipe` | OCR of a photo (Google Vision) + extraction with Claude | signed-in user |
| `nome-generico-ingredienti` | Normalizes ingredient names with Claude | signed-in user |
| `send-due-notifications` | Sends push notifications for expired timers and empties the bin | cron, via `x-cron-secret` header |

Functions that spend API credits verify the user's session token: the public key alone is not enough.

Secrets to set (never in the repository):

```bash
npx supabase secrets set ANTHROPIC_API_KEY=... GOOGLE_VISION_API_KEY=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=... \
  ALLOWED_ORIGIN=https://your-site.netlify.app
npx supabase functions deploy
```

`ALLOWED_ORIGIN` is optional but recommended. `send-due-notifications` must be called every minute by an external cron service (for example cron-job.org) with the `x-cron-secret` header.

The **public** VAPID key is also in `src/lib/push.js` (it is public by design): if you generate new keys, update both places.

## Publishing the site

With the Netlify CLI, from the project folder:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Alternatively, connect the repository to Netlify to redeploy on every push: in that case also set the two `VITE_SUPABASE_*` variables in Netlify's *Environment variables*.

In Supabase, under **Authentication → URL Configuration**, set your site address as the *Site URL* and in the *Redirect URLs*.

## If the app is only for you and your family

Sign-ups are open and the AI imports spend API credits. If you don't want strangers to create an account, turn off new sign-ups in Supabase (**Authentication → Sign In / Providers → Allow new users to sign up**) after creating the accounts you need.
