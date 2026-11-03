import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { CORS, requireUser, nonAutorizzato, chiaveAnthropicUtente, chiaveMancante, messaggioErroreAnthropic } from '../_shared/auth.ts'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const user = await requireUser(req)
    if (!user) return nonAutorizzato()

    // Ognuno usa la propria chiave Anthropic (header x-anthropic-key): paga chi la possiede.
    const anthropicKey = chiaveAnthropicUtente(req)
    if (!anthropicKey) return chiaveMancante()

    const { nomi } = await req.json()

    if (Array.isArray(nomi) && nomi.length > 100) {
      return new Response(JSON.stringify({ error: 'Troppi ingredienti' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    if (!Array.isArray(nomi) || nomi.length === 0) {
      return new Response(JSON.stringify({ generici: [] }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: buildPrompt(nomi) }],
      }),
    })
    if (!res.ok) throw new Error(messaggioErroreAnthropic(res.status, await res.text()))

    const data = await res.json()
    const raw = data.content?.[0]?.text ?? ''
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start === -1 || end === -1) throw new Error('Risposta Claude non contiene un array JSON valido')
    const generici = JSON.parse(raw.slice(start, end + 1))


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
