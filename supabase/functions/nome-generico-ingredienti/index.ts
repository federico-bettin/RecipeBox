import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICE_INPUT_PER_M  = 0.80
const PRICE_OUTPUT_PER_M = 4.00

function buildPrompt(nomi: string[]): string {
  return `Per ciascuno di questi nomi di ingredienti di ricette italiane, restituisci il nome "generico" più adatto da usare come filtro di ricerca in un ricettario.

Regole:
- Se il nome descrive una MISURA o un CONTENITORE seguito dal vero ingrediente (es. "Rametto di rosmarino", "Spicchio d'aglio", "Scorza di limone", "Foglia di alloro", "Pizzico di noce moscata"), restituisci SOLO il vero ingrediente, con l'iniziale maiuscola (es. "Rosmarino", "Aglio", "Limone", "Alloro", "Noce moscata").
- Se il nome è un PRODOTTO SPECIFICO con un significato proprio, che perderebbe senso se ridotto (es. "Biscotti secchi", "Gocce di cioccolato", "Farina 00", "Passata di pomodoro"), restituiscilo quasi per intero, senza ridurlo a una singola parola generica che ne cambi il significato.
- Aggettivi di stato/temperatura/preparazione che non cambiano il prodotto da acquistare (es. "caldo", "freddo", "tiepido", "molto ristretto", "tritato finemente") possono essere rimossi (es. "Caffè caldo molto ristretto" -> "Caffè").
- "Uova", "Albume/i", "Tuorlo/i" e ogni loro variante vanno SEMPRE generalizzati come "Uova".
- Mantieni sempre l'iniziale maiuscola, resto minuscolo.

Rispondi SOLO con un array JSON di stringhe, nello stesso ordine e con la stessa lunghezza dell'elenco fornito. Nessun markdown, nessun testo aggiuntivo.

Ingredienti:
${JSON.stringify(nomi)}

JSON:`
}

async function saveCost(userId: string, tokensIn: number, tokensOut: number) {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const costo = (tokensIn / 1_000_000) * PRICE_INPUT_PER_M + (tokensOut / 1_000_000) * PRICE_OUTPUT_PER_M
    await supabase.from('api_costs').insert({ user_id: userId, tipo: 'claude', tokens_input: tokensIn, tokens_output: tokensOut, costo_usd: costo })
  } catch (_) {}
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { nomi, user_id } = await req.json()

    if (!Array.isArray(nomi) || nomi.length === 0) {
      return new Response(JSON.stringify({ generici: [] }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY non configurata')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: buildPrompt(nomi) }],
      }),
    })
    if (!res.ok) throw new Error(`Claude API error: ${await res.text()}`)

    const data = await res.json()
    const raw = data.content?.[0]?.text ?? ''
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start === -1 || end === -1) throw new Error('Risposta Claude non contiene un array JSON valido')
    const generici = JSON.parse(raw.slice(start, end + 1))

    const usage = data.usage || {}
    if (user_id) await saveCost(user_id, usage.input_tokens || 0, usage.output_tokens || 0)

    // Sicurezza: se la lunghezza non combacia, meglio restituire null per tutti
    // (il frontend userà comunque l'euristica locale come ripiego) piuttosto che
    // disallineare i nomi generici dagli ingredienti sbagliati.
    const risultato = (Array.isArray(generici) && generici.length === nomi.length)
      ? generici
      : nomi.map(() => null)

    return new Response(JSON.stringify({ generici: risultato }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('nome-generico-ingredienti error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Errore sconosciuto' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
