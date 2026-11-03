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

**Tables used:** `recipes`, `ingredients`, `steps`, `user_ingredients`, `weekly_plans`, `plan_slots`, `profiles`, `api_costs`, `push_subscriptions`, `timer_notifications`, `recipe_provate`. **Storage bucket:** `recipe-photos`.

The full schema (tables, Row Level Security, triggers, permissions and the photo bucket) is in [`supabase/schema.sql`](../supabase/schema.sql): run it once in the SQL Editor of a new project. The file grants table permissions explicitly, because since 30 October 2026 Supabase no longer does it automatically; access without login (`anon`) stays closed.

**Edge functions** (`supabase/functions/`):

| Function | What it does | Access |
|---|---|---|
| `import-url` | Reads a web page and extracts the recipe with Claude | signed-in user, with their own Anthropic key |
| `ocr-recipe` | Claude reads a photo or PDF and extracts the recipe | signed-in user, with their own Anthropic key |
| `nome-generico-ingredienti` | Normalizes ingredient names with Claude | signed-in user, with their own Anthropic key |
| `send-due-notifications` | Sends push notifications for expired timers and empties the bin | cron, via `x-cron-secret` header |

Functions that spend API credits verify the user's session token: the public key alone is not enough.

Secrets to set (never in the repository):

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=... \
  ALLOWED_ORIGIN=https://your-site.netlify.app
npx supabase functions deploy
```

`ALLOWED_ORIGIN` is optional but recommended. `send-due-notifications` must be called every minute by an external cron service (for example cron-job.org) with the `x-cron-secret` header.

VAPID keys (for timer notifications) are generated with `npx web-push generate-vapid-keys`. The **public** key must also go in `src/lib/push.js`, in the `VAPID_PUBLIC_KEY` constant (it is public by design): if you use your own project, replace the existing one with yours, otherwise notifications won't work.

## Artificial intelligence: everyone uses their own key

Importing recipes from links, photos and PDFs uses Claude and has a cost, paid by whoever uses it. The app has **no Anthropic key on the server**: the user pastes their own in the Profile page and the app sends it with every import in the `x-anthropic-key` header. The function uses it for that request only and neither saves it nor writes it to logs. Without a key the function answers `403 CHIAVE_ANTHROPIC_MANCANTE` and the app explains what to do; the rest of the app keeps working.

So no `ANTHROPIC_API_KEY` secret is needed on Supabase. If you had one set, you can remove it: `npx supabase secrets unset ANTHROPIC_API_KEY GOOGLE_VISION_API_KEY`.

## Base recipes and personal recipes

- Recipes with `is_pubblica = true` are the **base**: readable by every signed-in user, editable only by whoever created them.
- Recipes users add are **personal** (`is_pubblica = false`).
- A user **cannot** make a recipe public: a trigger (`blocca_pubblicazione`) prevents it. Only the administrator, from the Supabase SQL Editor or with the `service_role` key, can:

```sql
update public.recipes set is_pubblica = true where id = 'RECIPE-ID';
```

- "Already tried" is per user, in the `recipe_provate` table.
- Public recipes in the bin are not visible to other users.

If you already have a project created with an earlier version, apply the migration [`supabase/migrations/20261103000000_ricette_base_e_personali.sql`](../supabase/migrations/20261103000000_ricette_base_e_personali.sql) in the SQL Editor. **Run the migration before deploying the new app**: it also copies the existing "already tried" marks into the new table.

## Publishing the site

With the Netlify CLI, from the project folder:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Alternatively, connect the repository to Netlify to redeploy on every push: in that case also set the two `VITE_SUPABASE_*` variables in Netlify's *Environment variables*.

In Supabase, under **Authentication → URL Configuration**, set your site address as the *Site URL* and in the *Redirect URLs*.

## Sign-ups

Anyone can sign up: everyone's recipes are personal and AI uses the key of whoever imports, so an extra user costs nothing to whoever runs the app. If you want to limit sign-ups (for example to a family), turn off new sign-ups in Supabase: **Authentication → Sign In / Providers → Allow new users to sign up**.
