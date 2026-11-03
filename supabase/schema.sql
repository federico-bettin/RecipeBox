-- ============================================================================
-- RecipeBox - schema del database (Supabase)
-- RecipeBox - database schema (Supabase)
--
-- IT: esegui questo file UNA sola volta nell'SQL Editor di un progetto Supabase
--     nuovo e vuoto. Crea tabelle, regole di sicurezza (RLS), trigger e il bucket
--     delle foto. Non contiene dati.
-- EN: run this file ONCE in the SQL Editor of a new, empty Supabase project.
--     It creates tables, security rules (RLS), triggers and the photo bucket.
--     It contains no data.
-- ============================================================================

create table if not exists public.api_costs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  costo_usd numeric(10,6) not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint api_costs_pkey PRIMARY KEY (id),
  constraint api_costs_tipo_check CHECK ((tipo = ANY (ARRAY['claude'::text, 'vision'::text])))
);

create table if not exists public.ingredients (
  id uuid not null default gen_random_uuid(),
  recipe_id uuid not null,
  nome text not null,
  quantita numeric,
  unita text,
  ordine integer not null default 0,
  created_at timestamp with time zone default now(),
  nome_generico text,
  constraint ingredients_pkey PRIMARY KEY (id)
);

create table if not exists public.plan_slots (
  id uuid not null default gen_random_uuid(),
  plan_id uuid not null,
  recipe_id uuid,
  giorno text not null,
  pasto text not null,
  created_at timestamp with time zone default now(),
  constraint plan_slots_pkey PRIMARY KEY (id),
  constraint plan_slots_plan_id_giorno_pasto_key UNIQUE (plan_id, giorno, pasto)
);

create table if not exists public.profiles (
  id uuid not null,
  nome text,
  diete text[] default '{}'::text[],
  created_at timestamp with time zone default now(),
  constraint profiles_pkey PRIMARY KEY (id)
);

create table if not exists public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone not null default now(),
  constraint push_subscriptions_endpoint_key UNIQUE (endpoint),
  constraint push_subscriptions_pkey PRIMARY KEY (id)
);

create table if not exists public.recipes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  titolo text not null,
  categoria text not null,
  tempo_minuti integer,
  difficolta text,
  porzioni_base integer default 4,
  diete text[] default '{}'::text[],
  note text,
  foto_url text,
  fonte_url text,
  fonte_tipo text,
  is_pubblica boolean default false,
  share_token uuid default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  tempo_riposo_minuti integer,
  tempo_totale_minuti integer,
  utensili text[],
  gia_provata boolean not null default false,
  tempo_preparazione_minuti integer,
  eliminata_il timestamp with time zone,
  constraint recipes_pkey PRIMARY KEY (id)
);

create table if not exists public.steps (
  id uuid not null default gen_random_uuid(),
  recipe_id uuid not null,
  testo text not null,
  timer_secondi integer,
  ordine integer not null default 0,
  created_at timestamp with time zone default now(),
  foto_url text,
  foto_urls text[] default '{}'::text[],
  constraint steps_pkey PRIMARY KEY (id)
);

create table if not exists public.timer_notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  titolo text not null,
  corpo text not null,
  due_at timestamp with time zone not null,
  stato text not null default 'in_attesa'::text,
  created_at timestamp with time zone not null default now(),
  constraint timer_notifications_pkey PRIMARY KEY (id)
);

create table if not exists public.user_ingredients (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  created_at timestamp with time zone default now(),
  constraint user_ingredients_pkey PRIMARY KEY (id),
  constraint user_ingredients_user_id_nome_key UNIQUE (user_id, nome)
);

create table if not exists public.weekly_plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  settimana_inizio date not null,
  note text,
  created_at timestamp with time zone default now(),
  constraint weekly_plans_pkey PRIMARY KEY (id),
  constraint weekly_plans_user_id_settimana_inizio_key UNIQUE (user_id, settimana_inizio)
);

alter table public.api_costs add constraint api_costs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.ingredients add constraint ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

alter table public.plan_slots add constraint plan_slots_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.weekly_plans(id) ON DELETE CASCADE;

alter table public.plan_slots add constraint plan_slots_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.recipes add constraint recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

alter table public.steps add constraint steps_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

alter table public.timer_notifications add constraint timer_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_ingredients add constraint user_ingredients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

alter table public.weekly_plans add constraint weekly_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_recipes_eliminata_il ON public.recipes USING btree (eliminata_il) WHERE (eliminata_il IS NOT NULL);

CREATE INDEX idx_timer_notifications_due ON public.timer_notifications USING btree (due_at) WHERE (stato = 'in_attesa'::text);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

alter table public.api_costs enable row level security;

alter table public.ingredients enable row level security;

alter table public.plan_slots enable row level security;

alter table public.profiles enable row level security;

alter table public.push_subscriptions enable row level security;

alter table public.recipes enable row level security;

alter table public.steps enable row level security;

alter table public.timer_notifications enable row level security;

alter table public.user_ingredients enable row level security;

alter table public.weekly_plans enable row level security;

create policy "Utente inserisce solo i propri costi" on public.api_costs as permissive for INSERT to public
  with check ((auth.uid() = user_id));

create policy "Utente vede solo i propri costi" on public.api_costs as permissive for SELECT to public
  using ((auth.uid() = user_id));

create policy "Ingredienti ricette pubbliche leggibili" on public.ingredients as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.recipes
  WHERE ((recipes.id = ingredients.recipe_id) AND (recipes.is_pubblica = true) AND (recipes.eliminata_il IS NULL)))));

create policy "Ingredienti visibili al proprietario della ricetta" on public.ingredients as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.recipes
  WHERE ((recipes.id = ingredients.recipe_id) AND (recipes.user_id = auth.uid())))));

create policy "Utente gestisce i propri slot" on public.plan_slots as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.weekly_plans
  WHERE ((weekly_plans.id = plan_slots.plan_id) AND (weekly_plans.user_id = auth.uid())))));

create policy "Utente vede solo il proprio profilo" on public.profiles as permissive for ALL to public
  using ((auth.uid() = id));

create policy "Utenti gestiscono le proprie sottoscrizioni push" on public.push_subscriptions as permissive for ALL to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy "Ricette pubbliche leggibili da tutti" on public.recipes as permissive for SELECT to public
  using (((is_pubblica = true) AND (eliminata_il IS NULL)));

create policy "Utente gestisce le proprie ricette" on public.recipes as permissive for ALL to public
  using ((auth.uid() = user_id));

create policy "Passi ricette pubbliche leggibili" on public.steps as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.recipes
  WHERE ((recipes.id = steps.recipe_id) AND (recipes.is_pubblica = true) AND (recipes.eliminata_il IS NULL)))));

create policy "Passi visibili al proprietario della ricetta" on public.steps as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.recipes
  WHERE ((recipes.id = steps.recipe_id) AND (recipes.user_id = auth.uid())))));

create policy "Utenti gestiscono i propri timer programmati" on public.timer_notifications as permissive for ALL to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy "Utente gestisce i propri ingredienti" on public.user_ingredients as permissive for ALL to public
  using ((auth.uid() = user_id));

create policy "Utente gestisce i propri piani" on public.weekly_plans as permissive for ALL to public
  using ((auth.uid() = user_id));

create policy "Utente carica le proprie foto" on storage.objects as permissive for INSERT to public
  with check (((bucket_id = 'recipe-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy "Utente elimina le proprie foto" on storage.objects as permissive for DELETE to public
  using (((bucket_id = 'recipe-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy "Utente vede le proprie foto" on storage.objects as permissive for SELECT to public
  using (((bucket_id = 'recipe-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

insert into storage.buckets (id, name, public) values ('recipe-photos', 'recipe-photos', 't') on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Ricette di base e ricette personali / Base recipes and personal recipes
-- IT: le ricette pubbliche (is_pubblica = true) sono la base visibile a tutti;
--     quelle che ogni utente aggiunge sono personali. Solo l'amministratore
--     (SQL Editor o service_role) può rendere pubblica una ricetta:
--       update public.recipes set is_pubblica = true where id = 'ID-DELLA-RICETTA';
--     "Già provata" è per utente (tabella recipe_provate).
-- EN: public recipes (is_pubblica = true) are the base visible to everyone;
--     recipes users add are personal. Only the administrator (SQL Editor or
--     service_role) can publish a recipe, as shown above. "Already tried" is
--     per user (recipe_provate table).
-- ----------------------------------------------------------------------------

create table if not exists public.recipe_provate (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.recipe_provate enable row level security;

create policy "Utente gestisce le proprie ricette provate" on public.recipe_provate
  as permissive for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.blocca_pubblicazione()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.is_pubblica is true
     and (tg_op = 'INSERT' or old.is_pubblica is distinct from true)
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    new.is_pubblica := false;
  end if;
  return new;
end;
$function$;

drop trigger if exists recipes_blocca_pubblicazione on public.recipes;
create trigger recipes_blocca_pubblicazione
  before insert or update on public.recipes
  for each row execute function public.blocca_pubblicazione();

-- ----------------------------------------------------------------------------
-- Permessi per l'API di Supabase / Permissions for the Supabase API
-- IT: dal 30 ottobre 2026 (e per i progetti creati dopo il 30 maggio 2026)
--     Supabase non concede più permessi automatici sulle nuove tabelle: vanno
--     dati qui. Gli utenti loggati (authenticated) lavorano sui dati, ma le
--     righe che possono vedere o modificare le decidono le policy (RLS) sopra.
--     L'accesso senza login (anon) resta chiuso. Se vuoi che le ricette
--     pubbliche siano leggibili anche senza login, aggiungi:
--       grant select on public.recipes, public.ingredients, public.steps to anon;
-- EN: since 30 Oct 2026 (and for projects created after 30 May 2026) Supabase no
--     longer grants permissions on new tables automatically, so they are granted
--     here. Signed-in users (authenticated) work on the data, but which rows
--     they can see or change is decided by the RLS policies above. Access
--     without login (anon) stays closed. To make public recipes readable
--     without login, add the grant shown above.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
