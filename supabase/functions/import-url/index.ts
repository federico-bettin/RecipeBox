import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { CORS, requireUser, nonAutorizzato, chiaveAnthropicUtente, chiaveMancante, messaggioErroreAnthropic } from '../_shared/auth.ts'

function extractOgImage(html: string): string | null {
  const m = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/) || html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/)
  return m ? m[1] : null
}

function extractJsonLd(html: string): any | null {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim())
      const items: any[] = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'Recipe') return item
        if (Array.isArray(item['@type']) && item['@type'].includes('Recipe')) return item
        if (item['@graph']) { const r = item['@graph'].find((n: any) => n['@type'] === 'Recipe'); if (r) return r }
      }
    } catch (_) { continue }
  }
  return null
}

function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0')
  const mn = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0')
  return h * 60 + mn || null
}

function extractFotoUrl(obj: any): string | null {
  if (!obj) return null
  if (typeof obj === 'string' && obj.startsWith('http')) return obj
  if (Array.isArray(obj)) { for (const i of obj) { const u = extractFotoUrl(i); if (u) return u } }
  if (typeof obj === 'object') {
    for (const k of ['url','contentUrl','@id']) { if (obj[k]?.startsWith?.('http')) return obj[k] }
  }
  return null
}

function extractStepImagesFromHtml(html: string, nSteps: number): (string|null)[] {
  const results: (string|null)[] = new Array(nSteps).fill(null)
  const patterns = [
    /<li[^>]*class="[^"]*step[^"]*"[^>]*>[\s\S]{0,500}?<img[^>]+src="([^"]+)"/gi,
    /<div[^>]*class="[^"]*step[^"]*"[^>]*>[\s\S]{0,500}?<img[^>]+src="([^"]+)"/gi,
    /data-step-image="([^"]+)"/gi,
  ]
  let idx = 0
  for (const pat of patterns) {
    if (idx >= nSteps) break
    let m: RegExpExecArray | null
    const re = new RegExp(pat.source, pat.flags)
    while ((m = re.exec(html)) !== null && idx < nSteps) {
      const url = m[1]
      if (url?.startsWith('http') && !url.includes('placeholder') && !url.includes('logo')) results[idx++] = url
    }
  }
  return results
}

// Estrae, se presenti, le foto associate a ciascun passo direttamente dal JSON-LD
// (recipeInstructions[i].image), usate come suggerimento aggiuntivo per Claude/foto.
function estraiFotoPassiDaJsonLd(ld: any): (string|null)[] {
  const istruzioni = ld?.recipeInstructions || []
  return istruzioni.map((s: any) => (typeof s === 'object' ? extractFotoUrl(s.image) : null))
}

const CATEGORIE_VALIDE = ['Antipasti','Primi','Secondi','Contorni','Dessert','Cocktail']

// Molti siti italiani non usano i nostri nomi esatti (es. "Dolci" invece di "Dessert").
// Mappa i sinonimi più comuni sulle nostre 6 categorie fisse. Usata come rete di
// sicurezza sulla categoria restituita da Claude, non come fonte primaria.
const CATEGORIA_SYNONYMS: Record<string,string> = {
  antipasti:'Antipasti', antipasto:'Antipasti', aperitivo:'Antipasti', aperitivi:'Antipasti', stuzzichini:'Antipasti',
  primi:'Primi', primo:'Primi', pasta:'Primi', paste:'Primi', risotti:'Primi', risotto:'Primi', zuppe:'Primi', zuppa:'Primi', minestre:'Primi', minestra:'Primi', gnocchi:'Primi',
  secondi:'Secondi', secondo:'Secondi', carne:'Secondi', carni:'Secondi', pesce:'Secondi', pesci:'Secondi', uova:'Secondi',
  contorni:'Contorni', contorno:'Contorni', verdure:'Contorni', insalate:'Contorni', insalata:'Contorni',
  dolci:'Dessert', dolce:'Dessert', dessert:'Dessert', torte:'Dessert', torta:'Dessert', biscotti:'Dessert', biscotto:'Dessert', pasticceria:'Dessert', pasticcini:'Dessert', crostate:'Dessert', gelati:'Dessert', gelato:'Dessert',
  cocktail:'Cocktail', bevande:'Cocktail', bevanda:'Cocktail', drink:'Cocktail', drinks:'Cocktail',
}

function mapCategoria(raw: string): string {
  const low = (raw || '').toLowerCase()
  const direct = CATEGORIE_VALIDE.find(c => low.includes(c.toLowerCase()))
  if (direct) return direct
  for (const syn of Object.keys(CATEGORIA_SYNONYMS)) {
    if (low.includes(syn)) return CATEGORIA_SYNONYMS[syn]
  }
  return ''
}

// Legge il breadcrumb dal JSON-LD "BreadcrumbList" (generato spesso da plugin SEO come
// Yoast) — utile come suggerimento extra per la categoria, es. "Dolci > Biscotti".
function extractBreadcrumbText(html: string): string {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim())
      const items: any[] = Array.isArray(data) ? data : [data]
      for (const item of items) {
        const graph = item['@graph'] || [item]
        for (const node of graph) {
          if (node['@type'] === 'BreadcrumbList' && Array.isArray(node.itemListElement)) {
            const nomi = node.itemListElement
              .map((el: any) => el.name || el.item?.name)
              .filter(Boolean)
            if (nomi.length) return nomi.join(' ')
          }
        }
      }
    } catch (_) { continue }
  }
  return ''
}

function extractText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<nav[\s\S]*?<\/nav>/gi,'').replace(/<footer[\s\S]*?<\/footer>/gi,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&egrave;/g,'e').replace(/&agrave;/g,'a').replace(/&ugrave;/g,'u').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,8000)
}

// Costruisce un riepilogo "pulito" dei dati strutturati del sito (se presenti), usato
// come suggerimento per Claude — MAI come fonte autoritativa: il testo della pagina
// resta il riferimento principale, così anche se il sito ha dati incompleti o sbagliati
// Claude può correggerli leggendo il resto della pagina.
function buildHintJsonLd(ld: any | null): string | null {
  if (!ld) return null
  const hint = {
    titolo_sito: ld.name || null,
    categoria_sito: Array.isArray(ld.recipeCategory) ? ld.recipeCategory.join(', ') : (ld.recipeCategory || null),
    porzioni_sito: (() => { const y = ld.recipeYield; if (!y) return null; const s = Array.isArray(y) ? y[0] : y; const n = parseInt(String(s)); return isNaN(n) ? null : n })(),
    tempo_preparazione_minuti_sito: parseDuration(ld.prepTime),
    tempo_cottura_minuti_sito: parseDuration(ld.cookTime),
    tempo_totale_minuti_sito: parseDuration(ld.totalTime),
    ingredienti_sito: (ld.recipeIngredient || []).slice(0, 60),
    passi_sito: (ld.recipeInstructions || []).map((s: any) => typeof s === 'string' ? s : (s.text || s.name || '')).filter(Boolean).slice(0, 60),
  }
  return JSON.stringify(hint)
}

function buildImportPrompt(testo: string, hintJsonLd: string | null, breadcrumb: string): string {
  return `Sei un assistente specializzato nell'estrarre ricette italiane da pagine web.
Restituisci SOLO un oggetto JSON valido, senza markdown, senza backtick, seguendo esattamente questo schema:

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
  "ingredienti": [{"nome":"","quantita":numero o null,"unita":"g/kg/ml/l/pz/cucchiai/cucchiaini/tazze/q.b./bustina/pizzico o null"}],
  "passi": [{"testo":"","timer_secondi":numero o null}]
}

Regole importanti:
- Estrai SOLO la ricetta principale della pagina: ignora altre ricette correlate/suggerite altrove nella pagina.
- Quantità sempre come numeri (es. "1/2" -> 0.5), mai come stringhe. Se un ingrediente non ha una quantità esplicita (es. "sale q.b."), usa unita:"q.b." e quantita:null.
- categoria: leggi "Dolci" come "Dessert", "Bevande"/"Drink" come "Cocktail", ecc. — scegli sempre una delle 6 categorie elencate sopra, mai un'altra parola.
- timer_secondi: valorizzalo solo se il passo indica un tempo esplicito (minuti convertiti in secondi).
- diete: deduci solo etichette certe in base agli ingredienti effettivi (Vegano/Vegetariano/Senza glutine/Senza lattosio).
- tempo_totale_minuti: se non indicato esplicitamente nel testo, calcolalo sommando preparazione+cottura+riposo.
- Se il testo della pagina è incompleto o ambiguo su un dato, usa il tuo giudizio per scegliere il valore più plausibile piuttosto che lasciarlo vuoto, ma non inventare ingredienti o passi che non sono presenti nel testo.
${hintJsonLd ? `
Il sito fornisce anche questi dati strutturati come suggerimento — usali per essere più preciso e completo, ma CORREGGILI leggendo il testo della pagina se sembrano incompleti, troncati o in contraddizione con esso. Non fidarti ciecamente di questi dati:
${hintJsonLd}
` : ''}${breadcrumb ? `\nBriciole di navigazione della pagina (utile per dedurre la categoria): ${breadcrumb}\n` : ''}
Testo della pagina:
---
${testo}
---

JSON:`
}

async function uploadFoto(fotoUrl: string, userId: string): Promise<string|null> {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const r = await fetch(fotoUrl,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)})
    if(!r.ok) return null
    const blob = await r.blob()
    const ext = blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg'
    const path = userId+'/'+Date.now()+'_import.'+ext
    const {error} = await sb.storage.from('recipe-photos').upload(path,blob,{contentType:blob.type})
    if(error) return null
    return sb.storage.from('recipe-photos').getPublicUrl(path).data.publicUrl
  } catch(_){return null}
}

// Evita che la funzione venga usata per leggere risorse interne (SSRF):
// accetta solo http/https verso host pubblici (niente localhost, IP privati o locali).
function urlPubblicaValida(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '[::1]') return false
    const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])]
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false
    }
    return true
  } catch (_) { return false }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

async function fetchPage(url: string): Promise<{html:string;ok:boolean;status:number}> {
  const attempts = [
    {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,*/*;q=0.8','Accept-Language':'it-IT,it;q=0.9','Referer':'https://www.google.it/'},
    {'User-Agent':'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/124.0.6367.82 Mobile Safari/537.36','Accept':'text/html,application/xhtml+xml,*/*;q=0.8','Accept-Language':'it-IT,it;q=0.9','Referer':'https://www.google.it/'},
    {'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15','Accept':'text/html,application/xhtml+xml,*/*;q=0.8','Accept-Language':'it-IT,it;q=0.9'},
    {'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','Accept':'text/html'},
  ]
  let lastStatus = 403
  for (const headers of attempts) {
    try {
      const res = await fetch(url,{headers,signal:AbortSignal.timeout(20000)})
      if(res.ok) return {html:await res.text(),ok:true,status:res.status}
      lastStatus = res.status
      if([403,429,503].includes(res.status)) { await sleep(400); continue }
      return {html:'',ok:false,status:res.status}
    } catch(_){ await sleep(400); continue }
  }
  return {html:'',ok:false,status:lastStatus}
}

serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:CORS})
  try {
    const user = await requireUser(req)
    if(!user) return nonAutorizzato()
    const user_id = user.id

    // Ognuno usa la propria chiave Anthropic (header x-anthropic-key): paga chi la possiede.
    const anthropicKey = chiaveAnthropicUtente(req)
    if(!anthropicKey) return chiaveMancante()

    const {url} = await req.json()
    if(!url) return new Response(JSON.stringify({error:'URL mancante'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}})
    if(!urlPubblicaValida(url)) return new Response(JSON.stringify({error:'URL non valido'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}})

    const {html,ok,status} = await fetchPage(url)
    if(!ok) {
      const errMsg=[403,429,503].includes(status)?'BLOCKED':'HTTP_'+status
      return new Response(JSON.stringify({error:errMsg}),{status:422,headers:{...CORS,'Content-Type':'application/json'}})
    }

    const fotoUrlEsterna = extractOgImage(html)
    const jsonLd = extractJsonLd(html)
    const testo = extractText(html)
    if (testo.length < 50 && !jsonLd) throw new Error('Pagina non leggibile')

    // Claude legge sempre il testo della pagina: i dati strutturati del sito (se
    // presenti) sono solo un suggerimento da verificare, mai la fonte esclusiva.
    const hintJsonLd = buildHintJsonLd(jsonLd)
    const breadcrumb = extractBreadcrumbText(html)
    const prompt = buildImportPrompt(testo, hintJsonLd, breadcrumb)

    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!cr.ok) throw new Error(messaggioErroreAnthropic(cr.status, await cr.text()))
    const cd = await cr.json()
    const rawText = cd.content?.[0]?.text ?? ''
    const start = rawText.indexOf('{')
    const end = rawText.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Risposta Claude non contiene JSON valido')
    const ricetta: any = JSON.parse(rawText.slice(start, end + 1))

    // Rete di sicurezza sulla categoria: garantisce che sia sempre una delle 6 valide,
    // anche se Claude avesse restituito qualcos'altro.
    ricetta.categoria = mapCategoria(ricetta.categoria || '') || mapCategoria(breadcrumb) || 'Primi'

    // Foto principale
    if (fotoUrlEsterna) ricetta.foto_url = await uploadFoto(fotoUrlEsterna, user_id)

    // Foto dei singoli passi: prova prima dal JSON-LD, poi dall'HTML per pattern comuni.
    if (Array.isArray(ricetta.passi) && ricetta.passi.length) {
      const fotoJsonLd = jsonLd ? estraiFotoPassiDaJsonLd(jsonLd) : []
      const fotoHtml = extractStepImagesFromHtml(html, ricetta.passi.length)
      ricetta.passi = ricetta.passi.map((p: any, i: number) => ({
        ...p,
        foto_url: p.foto_url || fotoJsonLd[i] || fotoHtml[i] || null,
      }))
      const haFotoPassi = ricetta.passi.some((p: any) => p.foto_url)
      if (!haFotoPassi) {
        const notaFoto = '⚠️ Le foto del procedimento non sono disponibili per questo sito — aggiungile manualmente dalla scheda modifica.'
        ricetta.note = [ricetta.note, notaFoto].filter(Boolean).join('\n\n')
      }
    }


    return new Response(JSON.stringify(ricetta),{headers:{...CORS,'Content-Type':'application/json'}})
  } catch(e) {
    console.error('import-url error:',e)
    return new Response(JSON.stringify({error:e instanceof Error?e.message:'Errore'}),{status:500,headers:{...CORS,'Content-Type':'application/json'}})
  }
})
