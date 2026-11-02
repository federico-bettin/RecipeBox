import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICE_CLAUDE_INPUT_PER_M  = 0.80
const PRICE_CLAUDE_OUTPUT_PER_M = 4.00
const PRICE_VISION_PER_REQ      = 0.0015

async function callVisionOCR(base64Image: string, apiKey: string): Promise<string> {
  const body = {
    requests: [{
      image: { content: base64Image },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      imageContext: { languageHints: ['it', 'en'] },
    }],
  }
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Vision error ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const resp = data.responses?.[0]
  if (resp?.error) throw new Error(`Vision API: ${resp.error.message}`)
  const fullText = resp?.fullTextAnnotation?.text ?? ''
  if (!fullText || fullText.trim().length < 5) {
    throw new Error('Nessun testo rilevato. Assicurati che la foto sia ben illuminata e contenga testo leggibile.')
  }
  return fullText.trim()
}

function buildPrompt(ocrText: string): string {
  return `Sei un assistente specializzato nell'estrarre ricette da testo OCR italiano.
Dal testo seguente estrai la ricetta e restituisci SOLO un oggetto JSON valido, senza markdown, senza backtick.

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
- Errori OCR: "lOO g"=100g, "l50 ml"=150ml, "1/2"=0.5
- Quantità = numeri, non stringhe
- Unità: g,kg,ml,l,pz,cucchiai,cucchiaini,tazze,q.b.,bustina
- timer_secondi: minuti×60 solo se tempo esplicito nel passo
- diete: analizza ingredienti → aggiungi solo etichette certe (Vegano/Vegetariano/Senza glutine/Senza lattosio)
- Ignora tabelle nutrizionali e allergeni
- Prendi solo la ricetta principale

Testo OCR:
---
${ocrText.slice(0, 7000)}
---

JSON:`
}

async function saveCosts(userId: string, tokensIn: number, tokensOut: number) {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const costoClaude = (tokensIn / 1_000_000) * PRICE_CLAUDE_INPUT_PER_M + (tokensOut / 1_000_000) * PRICE_CLAUDE_OUTPUT_PER_M
    await supabase.from('api_costs').insert([
      { user_id: userId, tipo: 'vision', tokens_input: 0, tokens_output: 0, costo_usd: PRICE_VISION_PER_REQ },
      { user_id: userId, tipo: 'claude', tokens_input: tokensIn, tokens_output: tokensOut, costo_usd: costoClaude },
    ])
  } catch (_) {}
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json()
    const { image, mimeType, user_id } = body

    if (!image) return new Response(
      JSON.stringify({ error: 'Immagine mancante' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

    const visionKey    = Deno.env.get('GOOGLE_VISION_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!visionKey)    throw new Error('GOOGLE_VISION_API_KEY non configurata')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY non configurata')

    // FIX: rimuove il prefisso data URL se presente (es. "data:image/jpeg;base64,...")
    // Alcuni browser Android mandano l'intera data URL invece del solo base64
    const cleanBase64 = typeof image === 'string' && image.includes(',')
      ? image.split(',')[1]
      : image

    // Valida che sia base64 valido
    if (!cleanBase64 || cleanBase64.length < 100) {
      throw new Error('Immagine non valida o troppo piccola')
    }

    console.log(`OCR request: mimeType=${mimeType}, base64 length=${cleanBase64.length}`)

    // 1. OCR con Google Vision
    const ocrText = await callVisionOCR(cleanBase64, visionKey)
    console.log(`OCR ok: ${ocrText.length} chars, preview: ${ocrText.slice(0,80)}`)

    // 2. Claude estrae la ricetta
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildPrompt(ocrText) }],
      }),
    })
    if (!claudeRes.ok) throw new Error(`Claude API error: ${await claudeRes.text()}`)

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.text ?? ''
    console.log(`Claude ok: ${rawText.length} chars`)

    // 3. Parsing JSON robusto: cerca il primo { e l'ultimo }
    const start = rawText.indexOf('{')
    const end   = rawText.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Risposta Claude non contiene JSON valido')
    const ricetta = JSON.parse(rawText.slice(start, end + 1))

    // 4. Traccia costi
    if (user_id) {
      const usage = claudeData.usage || {}
      await saveCosts(user_id, usage.input_tokens || 0, usage.output_tokens || 0)
    }

    return new Response(JSON.stringify(ricetta), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('ocr-recipe error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Errore sconosciuto' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
