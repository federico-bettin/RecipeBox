import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { CORS, requireUser, nonAutorizzato, chiaveAnthropicUtente, chiaveMancante, messaggioErroreAnthropic } from '../_shared/auth.ts'

const TIPI_IMMAGINE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Claude legge direttamente la foto (o il PDF) della ricetta: non serve più un
// servizio OCR a parte, quindi basta una sola chiave (Anthropic).
function buildPrompt(): string {
  return `Sei un assistente specializzato nell'estrarre ricette italiane da foto e documenti.
Nell'immagine o nel documento allegato c'è una ricetta: estraila e restituisci SOLO un oggetto JSON valido, senza markdown, senza backtick.

Schema JSON:
{
  "titolo": "stringa",
  "categoria": "una tra: Antipasti, Primi, Secondi, Contorni, Dessert, Cocktail",
  "tempo_preparazione_minuti": numero o null,
  "tempo_minuti": numero o null,
  "tempo_riposo_minuti": numero o null,
  "tempo_totale_minuti": numero o null,
  "difficolta": "Facile, Media o Difficile oppure null",
  "porzioni_base": numero intero o null,
  "utensili": [],
  "diete": [],
  "note": null,
  "ingredienti": [{"nome":"","quantita":null,"unita":null}],
  "passi": [{"testo":"","timer_secondi":null}]
}

Regole:
- Se il testo è sfocato o scritto a mano, interpretalo con buon senso ("lOO g"=100g, "l50 ml"=150ml, "1/2"=0.5)
- Quantità = numeri, non stringhe
- Unità: g,kg,ml,l,pz,cucchiai,cucchiaini,tazze,q.b.,bustina
- timer_secondi: minuti×60 solo se tempo esplicito nel passo
- diete: analizza ingredienti → aggiungi solo etichette certe (Vegano/Vegetariano/Senza glutine/Senza lattosio)
- Ignora tabelle nutrizionali e allergeni
- Prendi solo la ricetta principale
- Se nell'allegato non c'è nessuna ricetta leggibile, rispondi con {"errore":"nessuna ricetta"}

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

    const body = await req.json()
    const { image, mimeType } = body

    if (!image) return new Response(
      JSON.stringify({ error: 'Immagine mancante' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

    // Rimuove il prefisso data URL se presente (es. "data:image/jpeg;base64,...")
    const cleanBase64 = typeof image === 'string' && image.includes(',')
      ? image.split(',')[1]
      : image

    if (!cleanBase64 || cleanBase64.length < 100) {
      throw new Error('Immagine non valida o troppo piccola')
    }
    if (cleanBase64.length > 14_000_000) {
      throw new Error('Immagine troppo grande (max ~10 MB)')
    }

    const isPdf = mimeType === 'application/pdf'
    const mediaType = isPdf ? 'application/pdf' : (mimeType || 'image/jpeg')
    if (!isPdf && !TIPI_IMMAGINE.includes(mediaType)) throw new Error('FORMATO_NON_SUPPORTATO')

    const allegato = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cleanBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: cleanBase64 } }

    console.log(`OCR request: mimeType=${mediaType}, base64 length=${cleanBase64.length}`)

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: [allegato, { type: 'text', text: buildPrompt() }] }],
      }),
    })
    if (!claudeRes.ok) throw new Error(messaggioErroreAnthropic(claudeRes.status, await claudeRes.text()))

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.text ?? ''
    console.log(`Claude ok: ${rawText.length} chars`)

    // Parsing JSON robusto: cerca il primo { e l'ultimo }
    const start = rawText.indexOf('{')
    const end   = rawText.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Risposta Claude non contiene JSON valido')
    const ricetta = JSON.parse(rawText.slice(start, end + 1))
    if (ricetta.errore) throw new Error('Nessuna ricetta leggibile. Assicurati che la foto sia ben illuminata e a fuoco.')

    return new Response(JSON.stringify(ricetta), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('ocr-recipe error:', e instanceof Error ? e.message : e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Errore sconosciuto' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
