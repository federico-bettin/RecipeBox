import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Origine consentita per le chiamate dal browser. Imposta ALLOWED_ORIGIN
// (es. https://tuo-sito.netlify.app) con `supabase secrets set`; se manca,
// resta '*' (comodo in sviluppo, meno restrittivo in produzione).
export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const jsonHeaders = { ...CORS, 'Content-Type': 'application/json' }

// Verifica il token di sessione dell'utente (header Authorization: Bearer <JWT>)
// e restituisce l'utente autenticato, oppure null. La chiave "anon" pubblica
// NON è un utente valido: così solo chi ha fatto login può usare le funzioni
// che consumano crediti API.
export async function requireUser(req: Request): Promise<{ id: string } | null> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  return { id: data.user.id }
}

export function nonAutorizzato(): Response {
  return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401, headers: jsonHeaders })
}
