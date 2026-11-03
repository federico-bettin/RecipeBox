-- ============================================================================
-- IT: ricette "di base" (pubbliche, uguali per tutti) e ricette personali.
--     - le ricette già presenti restano pubbliche: sono la base per tutti;
--     - le ricette che ogni utente aggiunge sono personali (private);
--     - solo l'amministratore (SQL Editor / service_role) può rendere pubblica
--       una ricetta: un utente non può pubblicare le proprie;
--     - "già provata" diventa personale (tabella recipe_provate), così ognuno
--       segna le sue anche sulle ricette di base;
--     - le ricette pubbliche eliminate (nel cestino) non sono più visibili agli altri.
--     Esegui questo file una volta nell'SQL Editor di Supabase.
-- EN: "base" recipes (public, the same for everyone) and personal recipes.
--     Existing recipes stay public; recipes users add are private; only the
--     administrator can publish a recipe; "already tried" becomes per-user;
--     public recipes in the bin are no longer visible to others.
--     Run this file once in the Supabase SQL Editor.
-- ============================================================================

-- 1) "Già provata" per utente ------------------------------------------------
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

-- Dal 30 ottobre 2026 Supabase non concede più permessi automatici sulle nuove
-- tabelle: vanno dati in modo esplicito.
grant select, insert, update, delete on public.recipe_provate to authenticated, service_role;

-- Copia i segni "già provata" esistenti, assegnandoli a chi ha creato la ricetta.
insert into public.recipe_provate (user_id, recipe_id)
select user_id, id from public.recipes where gia_provata is true
on conflict do nothing;

-- 2) Solo l'amministratore pubblica ------------------------------------------
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

-- 3) Le ricette pubbliche nel cestino non si vedono più agli altri -------------
drop policy if exists "Ricette pubbliche leggibili da tutti" on public.recipes;
create policy "Ricette pubbliche leggibili da tutti" on public.recipes
  as permissive for select to public
  using (is_pubblica = true and eliminata_il is null);

drop policy if exists "Ingredienti ricette pubbliche leggibili" on public.ingredients;
create policy "Ingredienti ricette pubbliche leggibili" on public.ingredients
  as permissive for select to public
  using (exists (
    select 1 from public.recipes
    where recipes.id = ingredients.recipe_id and recipes.is_pubblica = true and recipes.eliminata_il is null));

drop policy if exists "Passi ricette pubbliche leggibili" on public.steps;
create policy "Passi ricette pubbliche leggibili" on public.steps
  as permissive for select to public
  using (exists (
    select 1 from public.recipes
    where recipes.id = steps.recipe_id and recipes.is_pubblica = true and recipes.eliminata_il is null));

-- ----------------------------------------------------------------------------
-- IT: per aggiungere una ricetta alla base (la rendi visibile a tutti), da qui:
-- EN: to add a recipe to the base (visible to everyone), from here:
--   update public.recipes set is_pubblica = true where id = 'ID-DELLA-RICETTA';
-- ----------------------------------------------------------------------------
