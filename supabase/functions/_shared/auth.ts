import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Origine consentita per le chiamate dal browser. Imposta ALLOWED_ORIGIN
// (es. https://tuo-sito.netlify.app) con `supabase secrets set`; se manca,
// resta '*' (comodo in sviluppo, meno restrittivo in produzione).
export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anthropic-key',
}

export const jsonHeaders = { ...CORS, 'Content-Type': 'application/json' }

// Verifica il token di sessione dell'utente (header Authorization: Bearer <JWT>)
// e restituisce l'utente autenticato, oppure null. La chiave "anon" pubblica
// NON è un utente valido: solo chi ha fatto login può usare le funzioni.
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

// ─── Intelligenza artificiale: ognuno usa la propria chiave Anthropic ────────

const FORMATO_CHIAVE_ANTHROPIC = /^sk-ant-[A-Za-z0-9_-]{20,}$/

// La chiave Anthropic arriva nell'header x-anthropic-key, inviata dall'app del
// singolo utente (la tiene solo nel suo browser). Si usa solo per quella
// richiesta: non viene salvata né scritta nei log, e i costi sono a carico di
// chi la possiede. L'app non ha una propria chiave: senza quella dell'utente
// l'AI non è disponibile (null).
export function chiaveAnthropicUtente(req: Request): string | null {
  const chiave = (req.headers.get('x-anthropic-key') ?? '').trim()
  return FORMATO_CHIAVE_ANTHROPIC.test(chiave) ? chiave : null
}

export function chiaveMancante(): Response {
  return new Response(JSON.stringify({ error: 'CHIAVE_ANTHROPIC_MANCANTE' }), { status: 403, headers: jsonHeaders })
}

// Traduce gli errori dell'API Anthropic in codici che l'app sa spiegare.
export function messaggioErroreAnthropic(status: number, body: string): string {
  if (status === 401 || status === 403) return 'CHIAVE_ANTHROPIC_NON_VALIDA'
  if (status === 400 && body.includes('credit balance')) return 'CREDITO_ANTHROPIC_ESAURITO'
  if (status === 429) return 'ANTHROPIC_TROPPE_RICHIESTE'
  return `Errore dell'API Claude (${status}): ${body.slice(0, 200)}`
}
