import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { UOVA_KEYWORDS, formattaUnita } from '../lib/ingredienti'
import { programmaNotificaTimer, annullaNotificaTimer } from '../lib/push'
import jsPDF from 'jspdf'

const CAT_COLORS = {
  Antipasti: '#2A9D8F', Primi: '#F4A261', Secondi: '#264653',
  Contorni: '#E9C46A', Dessert: '#E76F51', Cocktail: '#457B9D',
}

// Parole chiave per riconoscere uova/tuorli/albumi — ora importata da src/lib/ingredienti.js

const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

// Stima approssimativa del plurale italiano per l'ultima parola di un ingrediente,
// Stima approssimativa delle forme singolare/plurale collegate a una parola
// italiana, in ENTRAMBE le direzioni (non solo singolare->plurale come prima),
// usata solo per ampliare il riconoscimento nel testo del procedimento — non è
// linguisticamente perfetta, ma copre i casi più comuni (es. "uovo"->"uova" non
// rientra, gestito a parte; "farina"->"farine" e "zollette"->"zolletta" sì).
function formeCorrelate(parola) {
  const forme = new Set([parola])
  if (parola.endsWith('a')) forme.add(parola.slice(0, -1) + 'e')       // zolletta -> zollette
  if (parola.endsWith('o')) forme.add(parola.slice(0, -1) + 'i')       // zucchero -> zuccheri
  if (parola.endsWith('e')) { forme.add(parola.slice(0, -1) + 'i'); forme.add(parola.slice(0, -1) + 'a') } // forno->forni, zollette->zolletta
  if (parola.endsWith('i')) { forme.add(parola.slice(0, -1) + 'o'); forme.add(parola.slice(0, -1) + 'e') } // zuccheri->zucchero
  return [...forme]
}

// Parole troppo corte o generiche (articoli/preposizioni) da non evidenziare mai
// da sole, anche se compaiono in un nome ingrediente composto (es. "o" in
// "Melanzane tonde o viola" non va evidenziata da sola).
const STOPWORDS_INGREDIENTI = new Set([
  'o','e','ed','a','ad','di','da','in','con','per','tra','fra','su',
  'la','le','lo','gli','il','i','un','una','uno','senza',
  'al','allo','alla','ai','agli','alle','del','dello','della','dei','degli','delle',
])

// Costruisce l'elenco di termini (nome completo, plurale approssimativo, singole
// parole significative con relativo plurale) associati a un ingrediente, usato
// per riconoscerlo nel testo del procedimento.
// Rimuove le parti tra parentesi da un nome ingrediente prima di calcolare i
// termini di riconoscimento: il procedimento raramente ripete parola per
// parola una precisazione tra parentesi (es. "Formaggio (grattugiato)" -> il
// testo dirà solo "formaggio", non "formaggio (grattugiato)" con le parentesi).
const rimuoviParentesi = (s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()

function costruisciTerminiIngrediente(ing) {
  const nome = rimuoviParentesi((ing.nome || '').trim())
  if (!nome) return []
  const termini = new Set()
  const aggiungiConForme = (parola) => formeCorrelate(parola).forEach(f => termini.add(f))
  aggiungiConForme(nome)

  const parole = nome.split(' ')
  if (parole.length > 1) {
    const ultima = parole[parole.length - 1]
    formeCorrelate(ultima).forEach(formaUltima => {
      termini.add([...parole.slice(0, -1), formaUltima].join(' '))
    })

    // Solo la PRIMA parola del nome composto: in italiano il sostantivo
    // principale viene quasi sempre per primo (es. "Melanzane tonde o viola"
    // -> melanzane, "Pomodorini da forno" -> pomodorini, non "forno"). Le
    // parole successive sono spesso descrittive/generiche e darebbero troppi
    // falsi positivi se prese singolarmente.
    const prima = parole[0].replace(/[.,;:()]/g, '')
    if (prima.length > 3 && !STOPWORDS_INGREDIENTI.has(prima.toLowerCase())) {
      aggiungiConForme(prima)

      // Frase intera con la PRIMA parola cambiata (resto invariato): copre
      // casi come "Zollette di zucchero" (nome salvato) -> "Zolletta di
      // zucchero" (testo al singolare). Senza questa variante, il testo
      // riconoscerebbe "zolletta" e "zucchero" come due parole separate
      // invece che come un'unica frase, marcando per sbaglio anche un
      // eventuale ingrediente "Zucchero" a sé stante.
      formeCorrelate(prima).forEach(formaPrima => {
        termini.add([formaPrima, ...parole.slice(1)].join(' '))
      })
    }
  }
  return [...termini]
}

// Evidenzia in grassetto, cliccabile, la PRIMA occorrenza di ciascun ingrediente
// in tutto il procedimento (non ripete l'evidenziazione nei passi successivi).
// Calcolato al momento della visualizzazione (non tocca il salvataggio), quindi
// funziona anche sulle ricette già esistenti. Il tap su un ingrediente evidenziato
// lo segna come "usato", riflesso anche nel tab Ingredienti — utile per
// controllare a fine ricetta di non aver dimenticato nulla. Non è un
// riconoscimento perfetto al 100%: forme grammaticali molto diverse possono non
// essere riconosciute, e parole generiche condivise tra più ingredienti
// potrebbero dare qualche falso positivo.
function evidenziaProcedimento(passi, ingredienti, ingredientiUsati, onToggleIngrediente) {
  if (!ingredienti?.length) return passi.map(p => p.testo)

  const terminiConIdGrezzi = []
  ingredienti.forEach(ing => {
    costruisciTerminiIngrediente(ing).forEach(termine => terminiConIdGrezzi.push({ termine, id: ing.id }))
  })

  const contieneParola = (nome, chiave) => (nome || '').toLowerCase().includes(chiave)

  // "Uovo"/"uova" è un caso irregolare (singolare maschile che diventa plurale
  // femminile): la pluralizzazione automatica generica, basata su semplici
  // desinenze -o/-a/-e, non lo gestisce. Se l'ingrediente è "uovo/uova" (non
  // tuorlo/albume specifico), aggiungiamo esplicitamente entrambe le forme.
  ingredienti.forEach(ing => {
    if (contieneParola(ing.nome, 'uov') && !contieneParola(ing.nome, 'tuorl') && !contieneParola(ing.nome, 'album')) {
      ['uovo', 'uova'].forEach(t => terminiConIdGrezzi.push({ termine: t, id: ing.id }))
    }
  })

  // Caso speciale "famiglia uovo": un uovo è fatto di tuorlo + albume. Se la
  // ricetta ha un ingrediente "uovo/uova" generico ma NON una voce specifica
  // per tuorlo o per albume, il testo che nomina "tuorlo"/"albume" viene
  // comunque associato a quell'uovo generico (altrimenti resterebbe orfano,
  // dato che nessun ingrediente salvato contiene letteralmente quella parola).
  const ingUovoGenerico = ingredienti.find(ing => contieneParola(ing.nome, 'uov') && !contieneParola(ing.nome, 'tuorl') && !contieneParola(ing.nome, 'album'))
  if (ingUovoGenerico) {
    const haTuorloSpecifico = ingredienti.some(ing => contieneParola(ing.nome, 'tuorl'))
    const haAlbumeSpecifico = ingredienti.some(ing => contieneParola(ing.nome, 'album'))
    if (!haTuorloSpecifico) ['tuorlo', 'tuorli'].forEach(t => terminiConIdGrezzi.push({ termine: t, id: ingUovoGenerico.id }))
    if (!haAlbumeSpecifico) ['albume', 'albumi'].forEach(t => terminiConIdGrezzi.push({ termine: t, id: ingUovoGenerico.id }))
  }

  if (!terminiConIdGrezzi.length) return passi.map(p => p.testo)

  // Un termine (nome completo, prima parola, plurale...) condiviso da più
  // ingredienti DIVERSI dopo la normalizzazione è potenzialmente ambiguo.
  // Prima di escluderlo per entrambi, proviamo a risolverlo: se uno solo dei
  // contendenti ha quel termine come nome COMPLETO ed esatto (senza dover
  // togliere una parentesi o prendere solo la prima parola), quello vince —
  // è un indizio più forte. Copre "Burro" (vince) vs "Burro (per lo stampo)",
  // e "Zucchero" (vince) vs "Zucchero a velo".
  const idsPerTermine = {}
  terminiConIdGrezzi.forEach(({ termine, id }) => {
    const chiave = termine.toLowerCase()
    if (!idsPerTermine[chiave]) idsPerTermine[chiave] = new Set()
    idsPerTermine[chiave].add(id)
  })
  const terminiConId = []
  const chiaviProcessate = new Set()
  terminiConIdGrezzi.forEach(({ termine, id }) => {
    const chiave = termine.toLowerCase()
    if (chiaviProcessate.has(chiave)) return
    chiaviProcessate.add(chiave)
    const idsCoinvolti = idsPerTermine[chiave]
    if (idsCoinvolti.size === 1) { terminiConId.push({ termine, id }); return }
    const vincitori = ingredienti.filter(ing => idsCoinvolti.has(ing.id) && (ing.nome || '').trim().toLowerCase() === chiave)
    if (vincitori.length === 1) terminiConId.push({ termine, id: vincitori[0].id })
    // altrimenti resta ambiguo e viene escluso per tutti
  })
  if (!terminiConId.length) return passi.map(p => p.testo)
  terminiConId.sort((a, b) => b.termine.length - a.termine.length)

  const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\b(${terminiConId.map(t => escapeRegex(t.termine)).join('|')})\\b`, 'gi')
  const trovaId = (parola) => {
    const low = parola?.toLowerCase()
    const trovato = terminiConId.find(t => t.termine.toLowerCase() === low)
    return trovato ? trovato.id : null
  }

  const giaMostrati = new Set() // id ingredienti già evidenziati in un passo precedente

  return passi.map(passo => {
    const testo = passo.testo || ''
    const parti = testo.split(pattern)
    return parti.map((parte, i) => {
      if (i % 2 === 0) return parte // indici pari = testo normale, dispari = match
      const id = trovaId(parte)
      if (id === null || giaMostrati.has(id)) return parte
      giaMostrati.add(id)
      const usato = !!ingredientiUsati[id]
      return (
        <strong key={i} onClick={(e) => { e.stopPropagation(); onToggleIngrediente(id) }}
          style={{ cursor:'pointer', textDecoration: usato ? 'line-through' : 'none', color: usato ? '#8FA88F' : 'inherit', background: usato ? 'transparent' : 'rgba(244,162,97,0.28)', borderRadius:3, padding:'0 2px' }}>
          {parte}
        </strong>
      )
    })
  })
}

let sharedCtx = null
const getAudioCtx = () => {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  if (sharedCtx.state === 'suspended') sharedCtx.resume()
  return sharedCtx
}

const suonaCicalino = () => {
  try {
    const ctx = getAudioCtx(); if (!ctx) return
    const beep = (t, freq, dur) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'square'; osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t+0.01)
      gain.gain.setValueAtTime(0.3, t+dur-0.01)
      gain.gain.linearRampToValueAtTime(0, t+dur)
      osc.start(t); osc.stop(t+dur)
    }
    const t = ctx.currentTime
    beep(t, 880, 0.18); beep(t+0.25, 880, 0.18); beep(t+0.5, 1100, 0.35)
  } catch(e) { console.warn(e) }
}

// ─── TIMER BANNER ─────────────────────────────────────────────────────────────
function TimerBanner({ timer, onClose }) {
  const [remaining, setRemaining] = useState(timer.seconds)
  const [running, setRunning]     = useState(true)
  const [suonato, setSuonato]     = useState(false)
  const alarmRef = useRef(null)
  const tickRef  = useRef(null)

  const stopAlarm = () => { if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null } }
  useEffect(() => { setRemaining(timer.seconds); setRunning(true); setSuonato(false); stopAlarm() }, [timer])
  useEffect(() => () => stopAlarm(), [])

  useEffect(() => {
    if (!running) return
    tickRef.current = setInterval(() => setRemaining(r => {
      if (r <= 1) {
        clearInterval(tickRef.current)
        if (!suonato) {
          setSuonato(true); suonaCicalino(); alarmRef.current = setInterval(suonaCicalino, 2000)
          // Il countdown è suonato mentre l'app era in primo piano: annulliamo la
          // notifica push programmata per evitare che arrivi una seconda notifica
          // di sistema ridondante per lo stesso timer.
          annullaNotificaTimer(timer.notificaId)
        }
        return 0
      }
      return r - 1
    }), 1000)
    return () => clearInterval(tickRef.current)
  }, [running])

  const done = remaining <= 0
  const pct  = ((timer.seconds - remaining) / timer.seconds) * 100

  return (
    <div style={{ background: done ? '#2D6A2D' : '#1C1C1E', padding:'10px 16px', display:'flex', alignItems:'center', gap:12, transition:'background 0.4s', flexShrink:0 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, color: done ? '#9EE09E' : '#A8A8A0', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>
          {done ? '🔔 Tempo scaduto!' : `Passo ${timer.passo}`}
        </div>
        <div style={{ background:'#333', borderRadius:4, height:4, overflow:'hidden' }}>
          <div style={{ background: done ? '#5CB85C' : '#F4A261', height:'100%', width:`${pct}%`, borderRadius:4, transition:'width 1s linear' }} />
        </div>
      </div>
      <div style={{ fontSize:22, fontWeight:'bold', color: done ? '#9EE09E' : '#FDFAF6', fontFamily:'monospace', minWidth:56, textAlign:'center' }}>
        {fmt(remaining)}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {!done && (
          <button onClick={() => setRunning(r => !r)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, width:30, height:30, color:'#fff', fontSize:14, cursor:'pointer' }}>
            {running ? '⏸' : '▶'}
          </button>
        )}
        {done && suonato && (
          <button onClick={() => { stopAlarm(); setSuonato(false) }} style={{ background:'#E76F51', border:'none', borderRadius:8, padding:'0 12px', height:30, color:'#fff', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:'bold', whiteSpace:'nowrap' }}>
            🔕 Ferma
          </button>
        )}
        <button onClick={() => { stopAlarm(); if (!suonato) annullaNotificaTimer(timer.notificaId); onClose() }} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, width:30, height:30, color:'#fff', fontSize:14, cursor:'pointer' }}>✕</button>
      </div>
    </div>
  )
}

// ─── PANNELLO LISTA SPESA ─────────────────────────────────────────────────────
function PannelloSpesa({ ingredienti, scalaQty, titolo, onClose, qtyInCasa = {} }) {
  const listaIniziale = ingredienti.map((ing, i) => {
    const qtyRichiesta = scalaQty(ing)
    const hoInCasa = qtyInCasa[ing.id] !== undefined ? parseFloat(qtyInCasa[ing.id]) : null
    let qtyDaComprare = qtyRichiesta
    if (hoInCasa !== null && qtyRichiesta !== null) {
      qtyDaComprare = Math.max(0, parseFloat((qtyRichiesta - hoInCasa).toFixed(1)))
    }
    return { ...ing, id: ing.id ?? i, spuntato: false, qtyStr: qtyDaComprare !== null ? String(qtyDaComprare) : '' }
  })

  const [items,   setItems]   = useState(listaIniziale)
  const [inviato, setInviato] = useState(false)

  const toggleSpunta = id => setItems(prev => prev.map(it => it.id===id ? {...it, spuntato:!it.spuntato} : it))

  const visibili = items.filter(it => !it.spuntato)
  const spuntati = items.filter(it => it.spuntato)

  const testoWA = () => {
    return `🛒 *Lista della spesa — ${titolo}*\n\n` +
      visibili.map(it => {
        const qty = it.qtyStr ? `${it.qtyStr} ` : ''
        const unit = formattaUnita(it.unita, it.qtyStr)
        return `• ${it.nome}: ${qty}${unit}`.trimEnd()
      }).join('\n')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#FDFAF6', zIndex:300, display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>
      <div style={{ background:'#1C1C1E', padding:'52px 18px 14px', color:'#FDFAF6', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <div style={{ fontSize:18, fontWeight:'bold' }}>Lista della spesa</div>
      </div>

      <div style={{ flex:1, padding:'0 18px', overflowY:'auto' }}>
        {items.length === 0 ? (
          <div style={{ textAlign:'center', color:'#AAA', marginTop:60 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
            <div style={{ fontSize:14 }}>Nessun ingrediente da acquistare</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', padding:'14px 0 8px' }}>
              {visibili.length} da acquistare{spuntati.length > 0 ? ` · ${spuntati.length} acquistati` : ''}
            </div>
            <div style={{ fontSize:11, color:'#C96B2A', marginBottom:10, background:'#FFF8F2', borderRadius:8, padding:'6px 10px' }}>
              Spunta per segnare che l'hai acquistato
            </div>

            {visibili.map(it => (
              <div key={it.id} onClick={() => toggleSpunta(it.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F0EBE3', cursor:'pointer' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', border:'2px solid #CCC', background:'transparent', flexShrink:0 }} />
                <span style={{ flex:1, fontSize:14, color:'#1C1C1E' }}>{it.nome}</span>
                <span style={{ fontSize:14, fontWeight:'bold', color: it.qtyStr ? '#F4A261' : '#1C1C1E' }}>
                  {it.qtyStr} {formattaUnita(it.unita, it.qtyStr)}
                </span>
              </div>
            ))}

            {spuntati.length > 0 && (
              <>
                <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', padding:'16px 0 8px' }}>Acquistati</div>
                {spuntati.map(it => (
                  <div key={it.id} onClick={() => toggleSpunta(it.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F0EBE3', opacity:0.35, cursor:'pointer' }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', border:'2px solid #1C1C1E', background:'#1C1C1E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ color:'#fff', fontSize:12 }}>✓</span>
                    </div>
                    <span style={{ flex:1, fontSize:14, color:'#1C1C1E', textDecoration:'line-through' }}>{it.nome}</span>
                    <span style={{ fontSize:14, fontWeight:'bold', color:'#F4A261' }}>{it.qtyStr} {formattaUnita(it.unita, it.qtyStr)}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ padding:'12px 18px 32px', display:'flex', flexDirection:'column', gap:10, borderTop:'1px solid #E8E3DC' }}>
          {!inviato ? (
            <button onClick={() => setInviato(true)} style={{ background:'#E8572A', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#fff', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>🛍</span> Invia a Bring!
            </button>
          ) : (
            <div style={{ background:'#E8F5E9', borderRadius:14, padding:'13px', textAlign:'center', fontSize:13, color:'#2D6A2D', fontFamily:'Georgia,serif' }}>
              ✓ {visibili.length} ingredienti inviati a Bring!
            </div>
          )}
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(testoWA())}`, '_blank')}
            style={{ background:'#25D366', border:'none', borderRadius:14, padding:'12px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#fff', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>💬</span> Condividi su WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}

// ─── CONFERMA ELIMINA ─────────────────────────────────────────────────────────
function ModalConfermaElimina({ titolo, onConferma, onAnnulla }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#FDFAF6', borderRadius:'24px 24px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:480, boxShadow:'0 -8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <div style={{ width:36, height:4, background:'#DDDAD5', borderRadius:2 }} />
        </div>
        <div style={{ fontSize:18, fontWeight:'bold', color:'#1C1C1E', marginBottom:8, fontFamily:'Georgia,serif' }}>Sposta nel cestino</div>
        <div style={{ fontSize:14, color:'#888', fontFamily:'Georgia,serif', marginBottom:24, lineHeight:1.5 }}>
          Vuoi spostare <strong style={{ color:'#1C1C1E' }}>"{titolo}"</strong> nel cestino? Resterà lì per 7 giorni, puoi ripristinarla dal tuo Profilo.
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onAnnulla} style={{ flex:1, background:'#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', fontWeight:'bold' }}>Annulla</button>
          <button onClick={onConferma} style={{ flex:1, background:'#E76F51', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#fff', fontWeight:'bold' }}>🗑 Sposta nel cestino</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Ricetta() {
  const navigate  = useNavigate()
  const { id }    = useParams()

  const [ricetta,     setRicetta]     = useState(null)
  const [ingredienti, setIngredienti] = useState([])
  const [passi,       setPassi]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('info')
  const [modalita,    setModalita]    = useState('spesa')
  const [spuntati,    setSpuntati]    = useState({})
  const [qtyInCasa,   setQtyInCasa]   = useState({})
  const [editIngId,   setEditIngId]   = useState(null)
  const [qtyOverride, setQtyOverride] = useState({})
  const [cucinaBase,  setCucinaBase]  = useState(null)
  const [activeTimer, setActiveTimer] = useState(null)
  const [passoAttivo, setPassoAttivo] = useState(null)
  const [menuAperto,  setMenuAperto]  = useState(false)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [mostraSpesa, setMostraSpesa] = useState(false)
  const [giaProvata,  setGiaProvata]  = useState(false)
  const [ingredientiUsati, setIngredientiUsati] = useState({}) // { [ingId]: true } — toggle da tap sul procedimento

  // Scaling: se la ricetta ha uova in "pz", si scala per uova; altrimenti per porzioni
  const [porzioni,    setPorzioni]    = useState(4)
  const [uovaScelte,  setUovaScelte]  = useState(null)  // null se non usato

  useEffect(() => {
    const load = async () => {
      const { data: r }     = await supabase.from('recipes').select('*').eq('id', id).single()
      const { data: ings }  = await supabase.from('ingredients').select('*').eq('recipe_id', id).order('ordine')
      const { data: steps } = await supabase.from('steps').select('*').eq('recipe_id', id).order('ordine')
      setRicetta(r)
      setIngredienti(ings || [])
      setPassi(steps || [])
      setIngredientiUsati({})
      if (r) {
        setGiaProvata(r.gia_provata || false)
        const pb = r.porzioni_base || 4
        setPorzioni(pb)
        // Cerca ingrediente uova/tuorli/albumi senza unità (conteggio a pezzi, es. "2 uova")
        const uovaIngIniziale = (ings || []).find(i =>
          UOVA_KEYWORDS.some(k => i.nome.toLowerCase().includes(k)) && !i.unita && i.quantita
        )
        if (uovaIngIniziale) setUovaScelte(uovaIngIniziale.quantita)
        else setUovaScelte(null)
      }
      setLoading(false)
    }
    load()
  }, [id])

  // Ingrediente uova (se presente) — riconosciuto dal nome e dall'assenza di unità (conteggio a pezzi)
  const uovaIng = ingredienti.find(i =>
    UOVA_KEYWORDS.some(k => i.nome.toLowerCase().includes(k)) && !i.unita && i.quantita
  )
  const haUova = !!uovaIng && uovaScelte !== null

  // Ratio di scaling
  const porzioniBase = ricetta?.porzioni_base || 4
  const ratio = haUova
    ? (uovaScelte / uovaIng.quantita)
    : cucinaBase
      ? cucinaBase.ratio
      : (porzioni / porzioniBase)
  const porzioniCalcolate = haUova ? Math.round(porzioniBase * ratio) : porzioni
  const scalato = Math.abs(ratio - 1) > 0.001

  const scalaQty = (ing) => {
    if (!ing.quantita) return null
    if (modalita === 'cucina' && !haUova && qtyOverride[ing.id] !== undefined) {
      return parseFloat(qtyOverride[ing.id]) || null
    }
    if (haUova && ing.id === uovaIng.id) return uovaScelte
    const val = ing.quantita * ratio
    return Number.isInteger(val) ? val : parseFloat(val.toFixed(1))
  }

  const toggleIngredienteUsato = (ingId) => setIngredientiUsati(prev => ({ ...prev, [ingId]: !prev[ingId] }))
  const procedimentoEvidenziato = useMemo(
    () => evidenziaProcedimento(passi, ingredienti, ingredientiUsati, toggleIngredienteUsato),
    [passi, ingredienti, ingredientiUsati]
  )
  const nIngredientiUsati = Object.values(ingredientiUsati).filter(Boolean).length

  const toggleGiaProvata = async () => {
    const v = !giaProvata
    setGiaProvata(v)
    await supabase.from('recipes').update({ gia_provata: v }).eq('id', id)
  }

  const eliminaRicetta = async () => {
    // Cestino: non cancella subito, sposta la ricetta nel cestino per 7 giorni
    // (foto comprese, per poterla ripristinare intatta). La cancellazione
    // definitiva avviene automaticamente dopo 7 giorni, oppure a mano dal
    // Cestino in Profilo.
    await supabase.from('recipes').update({ eliminata_il: new Date().toISOString() }).eq('id', id)
    navigate('/', { replace: true })
  }

  const esportaPDF = async () => {
    const doc = new jsPDF()
    const margine = 14
    const larghezzaUtile = 210 - margine * 2
    let y = 20

    const nuovaPaginaSeServe = (altezzaRiga = 6) => {
      if (y > 280 - altezzaRiga) { doc.addPage(); y = 20 }
    }

    doc.setFontSize(18)
    doc.text(ricetta.titolo, margine, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(120)
    const sottotitolo = [ricetta.categoria, ricetta.difficolta, ricetta.tempo_totale_minuti ? `${ricetta.tempo_totale_minuti} min totali` : null].filter(Boolean).join(' · ')
    if (sottotitolo) { doc.text(sottotitolo, margine, y); y += 10 } else { y += 4 }
    doc.setTextColor(0)

    doc.setFontSize(13)
    doc.text(`Ingredienti (${porzioniCalcolate} porzioni)`, margine, y)
    y += 7
    doc.setFontSize(10)
    ingredienti.forEach(ing => {
      nuovaPaginaSeServe()
      const qty = scalaQty(ing)
      const riga = `•  ${ing.nome}${qty !== null ? `: ${qty} ${formattaUnita(ing.unita, qty)}`.trimEnd() : ''}`
      doc.text(riga, margine, y)
      y += 6
    })

    y += 4
    nuovaPaginaSeServe(13)
    doc.setFontSize(13)
    doc.text('Procedimento', margine, y)
    y += 7
    doc.setFontSize(10)
    passi.forEach((p, i) => {
      const righe = doc.splitTextToSize(`${i + 1}. ${p.testo}`, larghezzaUtile)
      righe.forEach(riga => { nuovaPaginaSeServe(); doc.text(riga, margine, y); y += 6 })
      y += 2
    })

    if (ricetta.note) {
      y += 4
      nuovaPaginaSeServe(13)
      doc.setFontSize(13)
      doc.text('Note', margine, y)
      y += 7
      doc.setFontSize(10)
      const righeNote = doc.splitTextToSize(ricetta.note, larghezzaUtile)
      righeNote.forEach(riga => { nuovaPaginaSeServe(); doc.text(riga, margine, y); y += 6 })
    }

    const blob = doc.output('blob')
    const nomeFile = `${ricetta.titolo.replace(/[^\w\s-]/g, '')}.pdf`
    const file = new File([blob], nomeFile, { type: 'application/pdf' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: ricetta.titolo }); return } catch (e) { /* utente ha annullato, procedi col download */ }
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = nomeFile
    a.click()
    URL.revokeObjectURL(url)
  }

  const avviaTimer = passo => {
    getAudioCtx()
    const key = Date.now()
    setActiveTimer({ passo: passo.ordine + 1, seconds: passo.timer_secondi, key, notificaId: null })
    // La notifica push viene programmata in background: il countdown visibile
    // parte subito comunque, senza aspettare la registrazione della notifica
    // (che richiede il permesso e una chiamata di rete).
    programmaNotificaTimer({
      titolo: `${ricetta.titolo} — Passo ${passo.ordine + 1}`,
      corpo: 'Il timer è scaduto!',
      secondi: passo.timer_secondi,
      url: `/ricetta/${id}`,
    }).then(notificaId => {
      setActiveTimer(prev => (prev && prev.key === key) ? { ...prev, notificaId } : prev)
    })
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:28, color:'#A8A8A0' }}>🍳</div>
    </div>
  )
  if (!ricetta) return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#A8A8A0', fontFamily:'Georgia,serif' }}>Ricetta non trovata.</div>
    </div>
  )

  const color        = CAT_COLORS[ricetta.categoria] || '#F4A261'
  const daAcquistare = ingredienti.filter(i => !spuntati[i.id])

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Overlay lista spesa */}
      {mostraSpesa && (
        <PannelloSpesa
          ingredienti={daAcquistare}
          scalaQty={scalaQty}
          titolo={ricetta.titolo}
          onClose={() => setMostraSpesa(false)}
          qtyInCasa={qtyInCasa}
        />
      )}

      {/* Modale conferma elimina */}
      {confermaElimina && (
        <ModalConfermaElimina
          titolo={ricetta.titolo}
          onConferma={eliminaRicetta}
          onAnnulla={() => setConfermaElimina(false)}
        />
      )}

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 18px 16px', color:'#FDFAF6', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={() => navigate(-1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>‹</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase' }}>{ricetta.categoria}</div>
          <div style={{ fontSize:17, fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ricetta.titolo}</div>
        </div>
        {/* Menu azioni */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setMenuAperto(m => !m)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'6px 12px', color:'#fff', fontSize:18, cursor:'pointer', lineHeight:1 }}>···</button>
          {menuAperto && (
            <>
              <div onClick={() => setMenuAperto(false)} style={{ position:'fixed', inset:0, zIndex:10 }} />
              <div style={{ position:'absolute', top:'110%', right:0, background:'#fff', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', overflow:'hidden', minWidth:160, zIndex:20 }}>
                <button onClick={() => { setMenuAperto(false); navigate(`/modifica/${id}`) }}
                  style={{ width:'100%', background:'none', border:'none', padding:'13px 16px', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #F0EBE3' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F7F4F0'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  ✎ Modifica
                </button>
                <button onClick={() => { setMenuAperto(false); esportaPDF() }}
                  style={{ width:'100%', background:'none', border:'none', padding:'13px 16px', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #F0EBE3' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F7F4F0'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  📄 Esporta PDF
                </button>
                <button onClick={() => { setMenuAperto(false); setConfermaElimina(true) }}
                  style={{ width:'100%', background:'none', border:'none', padding:'13px 16px', fontSize:13, fontFamily:'Georgia,serif', color:'#E76F51', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}
                  onMouseEnter={e => e.currentTarget.style.background='#FFF0F0'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  🗑 Elimina
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Timer banner */}
      {activeTimer && <TimerBanner key={activeTimer.key} timer={activeTimer} onClose={() => setActiveTimer(null)} />}

      {/* Hero */}
      <div style={{ position:'relative', height: ricetta.foto_url ? 180 : 90, flexShrink:0 }}>
        {ricetta.foto_url ? (
          <img src={ricetta.foto_url} alt={ricetta.titolo} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ background:`linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`, height:'100%' }} />
        )}
        <div style={{ position:'absolute', bottom:12, left:18, display:'flex', gap:8, flexWrap:'wrap' }}>
          {ricetta.tempo_minuti && <span style={{ background:'rgba(0,0,0,0.35)', color:'#fff', borderRadius:20, padding:'4px 12px', fontSize:12 }}>⏱ {ricetta.tempo_minuti} min</span>}
          {ricetta.difficolta   && <span style={{ background:'rgba(0,0,0,0.35)', color:'#fff', borderRadius:20, padding:'4px 12px', fontSize:12 }}>{ricetta.difficolta}</span>}
        </div>
      </div>

      {/* Controllo scala — uova o porzioni */}
      <div style={{ background:'#EEEAE3', padding:'10px 18px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        {haUova ? (
          <>
            <div>
              <div style={{ fontSize:10, letterSpacing:2, color:'#888', textTransform:'uppercase' }}>Uova</div>
              <div style={{ fontSize:10, color:'#C96B2A', marginTop:1 }}>→ {porzioniCalcolate} porzioni</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
              <button onClick={() => setUovaScelte(u => Math.max(1, u - 1))}
                style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:'50%', width:28, height:28, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
              <span style={{ fontSize:18, fontWeight:'bold', minWidth:24, textAlign:'center' }}>{uovaScelte}</span>
              <button onClick={() => setUovaScelte(u => u + 1)}
                style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:'50%', width:28, height:28, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            </div>
            {scalato && <span style={{ fontSize:11, color:'#F4A261' }}>×{ratio.toFixed(2)}</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize:11, letterSpacing:2, color:'#888', textTransform:'uppercase' }}>Porzioni</span>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
              <button onClick={() => setPorzioni(p => Math.max(1, p-1))}
                style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:'50%', width:28, height:28, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
              <span style={{ fontSize:18, fontWeight:'bold', minWidth:24, textAlign:'center' }}>{porzioni}</span>
              <button onClick={() => setPorzioni(p => p+1)}
                style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:'50%', width:28, height:28, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            </div>
            {scalato && <span style={{ fontSize:11, color:'#F4A261' }}>×{ratio.toFixed(2)}</span>}
          </>
        )}
      </div>

      {/* Tab bar — Info | Ingredienti | Procedimento */}
      <div style={{ display:'flex', borderBottom:'1px solid #E8E3DC', flexShrink:0 }}>
        {[{key:'info',label:'Info'},{key:'ingredienti',label:'Ingredienti'},{key:'procedimento',label:'Procedimento'}].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, background:'none', border:'none',
            borderBottom: tab===t.key ? '2px solid #1C1C1E' : '2px solid transparent',
            padding:'11px 4px', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif',
            fontWeight: tab===t.key ? 'bold' : 'normal',
            color: tab===t.key ? '#1C1C1E' : '#A8A8A0',
            textTransform:'uppercase', letterSpacing:1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Contenuto */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 18px', paddingBottom: tab==='ingredienti' ? 90 : 24 }}>

        {/* ── INFO ── */}
        {tab === 'info' && (
          <div>
            {/* Già provata toggle */}
            <div onClick={toggleGiaProvata} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background: giaProvata ? '#E8F5E9' : '#EEEAE3', borderRadius:14, padding:'14px 16px', marginBottom:14, cursor:'pointer', transition:'background 0.2s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:22 }}>{giaProvata ? '👍' : '👋'}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:'bold', color:'#1C1C1E' }}>Già provata</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{giaProvata ? 'Sì, l\'hai già cucinata' : 'Non ancora provata'}</div>
                </div>
              </div>
              <div style={{ width:44, height:26, borderRadius:13, background: giaProvata ? '#2D6A2D' : '#C5C0B8', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                <div style={{ position:'absolute', top:3, left: giaProvata ? 21 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
            </div>

            {/* Griglia dati */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              {[
                { label:'Porzioni base', value: ricetta.porzioni_base ? `${ricetta.porzioni_base} porz.` : '—' },
                { label:'Difficoltà',    value: ricetta.difficolta || '—' },
                { label:'Preparazione',  value: ricetta.tempo_preparazione_minuti ? `${ricetta.tempo_preparazione_minuti} min` : '—' },
                { label:'Cottura',       value: ricetta.tempo_minuti ? `${ricetta.tempo_minuti} min` : '—' },
                { label:'Riposo',        value: ricetta.tempo_riposo_minuti ? `${ricetta.tempo_riposo_minuti} min` : '—' },
                { label:'Totale',        value: ricetta.tempo_totale_minuti ? `${ricetta.tempo_totale_minuti} min` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:'#EEEAE3', borderRadius:12, padding:'12px 14px' }}>
                  <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Diete */}
            {(ricetta.diete || []).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8 }}>Filtri dieta</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {ricetta.diete.map(d => (
                    <span key={d} style={{ background:'#EEEAE3', borderRadius:20, padding:'6px 12px', fontSize:12, color:'#1C1C1E' }}>{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Utensili */}
            {(ricetta.utensili || []).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8 }}>Utensili necessari</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {ricetta.utensili.map((u, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#EEEAE3', borderRadius:12 }}>
                      <span style={{ fontSize:16 }}>🍴</span>
                      <span style={{ fontSize:13, color:'#1C1C1E' }}>{u}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {ricetta.note && (
              <div style={{ background:'#FFF8F2', borderRadius:14, padding:'14px', border:'1px solid #F4E0CC' }}>
                <div style={{ fontSize:10, letterSpacing:2, color:'#C96B2A', textTransform:'uppercase', marginBottom:6 }}>Note</div>
                <div style={{ fontSize:13, color:'#1C1C1E', lineHeight:1.6 }}>{ricetta.note}</div>
              </div>
            )}
          </div>
        )}

        {/* ── INGREDIENTI ── */}
        {tab === 'ingredienti' && (
          <div>
            {/* Selettore modalità */}
            <div style={{ display:'flex', background:'#EEEAE3', borderRadius:12, padding:3, marginBottom:14 }}>
              {[
                {key:'spesa',  label:'🛒 Fare la spesa'},
                {key:'cucina', label:'🍳 Cucina con quello che hai'},
              ].map(m => (
                <button key={m.key} onClick={() => {
                  setModalita(m.key)
                  setSpuntati({}); setQtyInCasa({})
                  setQtyOverride({}); setCucinaBase(null)
                }} style={{
                  flex:1, background: modalita===m.key ? '#1C1C1E' : 'transparent',
                  color: modalita===m.key ? '#fff' : '#888',
                  border:'none', borderRadius:10, padding:'7px 4px',
                  fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif',
                  fontWeight: modalita===m.key ? 'bold' : 'normal', transition:'all 0.2s',
                }}>{m.label}</button>
              ))}
            </div>

            <div style={{ fontSize:11, color:'#AAA', marginBottom:12, textAlign:'center' }}>
              {modalita==='spesa'
                ? "Spunta se ce l'hai · tap sulla quantità per scrivere quanto ne hai in casa"
                : haUova
                  ? 'Modifica le uova con +/− · gli altri si proporzionano'
                  : 'Tap sulla quantità per modificarla · gli altri si proporzionano'}
            </div>

            {ingredienti.length === 0 && (
              <div style={{ color:'#A8A8A0', fontSize:13, textAlign:'center', padding:'20px 0' }}>Nessun ingrediente inserito.</div>
            )}

            {/* ── FARE LA SPESA ── */}
            {modalita === 'spesa' && ingredienti.map(ing => {
              const isSpuntato = !!spuntati[ing.id]
              const qtyRichiesta = scalaQty(ing)
              const qtyHo = qtyInCasa[ing.id] !== undefined ? parseFloat(qtyInCasa[ing.id]) : null
              const isEditingInCasa = editIngId === ing.id
              return (
                <div key={ing.id} style={{ padding:'10px 0', borderBottom:'1px solid #F0EBE3' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, opacity: isSpuntato ? 0.4 : 1 }}>
                    <div onClick={() => setSpuntati(p => ({ ...p, [ing.id]: !p[ing.id] }))} style={{
                      width:22, height:22, borderRadius:'50%', border:'2px solid',
                      borderColor: isSpuntato ? '#1C1C1E' : '#CCC',
                      background: isSpuntato ? '#1C1C1E' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer',
                    }}>
                      {isSpuntato && <span style={{ color:'#fff', fontSize:12 }}>✓</span>}
                    </div>
                    <span style={{ flex:1, fontSize:14, color:'#1C1C1E', textDecoration: isSpuntato ? 'line-through' : 'none', display:'flex', alignItems:'center', gap:6 }}>
                      {ing.nome}
                      {ingredientiUsati[ing.id] && <span title="Usato nel procedimento" style={{ fontSize:11, color:'#8FA88F' }}>✓ usato</span>}
                    </span>
                    {!isSpuntato && (isEditingInCasa ? (
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:11, color:'#A8A8A0' }}>Ho:</span>
                        <input autoFocus value={qtyInCasa[ing.id] ?? ''}
                          onChange={e => setQtyInCasa(p => ({ ...p, [ing.id]: e.target.value }))}
                          onFocus={e => e.target.select()}
                          onBlur={() => setEditIngId(null)}
                          onKeyDown={e => e.key === 'Enter' && setEditIngId(null)}
                          style={{ width:54, background:'#EEEAE3', border:'none', borderRadius:8, padding:'4px 8px', fontSize:13, fontFamily:'Georgia,serif', textAlign:'center', outline:'none', color:'#1C1C1E', fontWeight:'bold' }}
                        />
                        <span style={{ fontSize:12, color:'#888' }}>{formattaUnita(ing.unita, qtyInCasa[ing.id])}</span>
                      </div>
                    ) : (
                      <span onClick={() => setEditIngId(ing.id)}
                        style={{ fontSize:14, fontWeight:'bold', color: qtyHo !== null ? '#E76F51' : scalato ? '#F4A261' : '#1C1C1E', cursor:'pointer', borderBottom:'1px dashed #F4A261', paddingBottom:1 }}>
                        {qtyRichiesta ?? '—'} {formattaUnita(ing.unita, qtyRichiesta)}
                      </span>
                    ))}
                    {isSpuntato && <span style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E' }}>{qtyRichiesta ?? '—'} {formattaUnita(ing.unita, qtyRichiesta)}</span>}
                  </div>
                  {!isSpuntato && qtyHo !== null && qtyRichiesta !== null && (
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4, fontSize:11, color:'#A8A8A0' }}>
                      <span>In casa: {qtyHo} {formattaUnita(ing.unita, qtyHo)}</span>
                      {qtyHo < qtyRichiesta
                        ? <span style={{ color:'#E76F51', fontWeight:'bold' }}>Da comprare: {parseFloat((qtyRichiesta - qtyHo).toFixed(1))} {formattaUnita(ing.unita, qtyRichiesta - qtyHo)}</span>
                        : <span style={{ color:'#2D6A2D' }}>✓ Sufficiente</span>
                      }
                    </div>
                  )}
                </div>
              )
            })}

            {/* ── CUCINA CON QUELLO CHE HAI ── */}
            {modalita === 'cucina' && (
              <>
                {haUova && (
                  <div style={{ background:'#EEEAE3', borderRadius:12, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:1 }}>{uovaIng.nome}</div>
                      <div style={{ fontSize:10, color:'#C96B2A', marginTop:1 }}>→ {porzioniCalcolate} porzioni</div>
                    </div>
                    <button onClick={() => setUovaScelte(u => Math.max(1, u - 1))}
                      style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:'50%', width:32, height:32, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                    <span style={{ fontSize:22, fontWeight:'bold', minWidth:28, textAlign:'center' }}>{uovaScelte}</span>
                    <button onClick={() => setUovaScelte(u => u + 1)}
                      style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:'50%', width:32, height:32, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                )}
                {ingredienti.map(ing => {
                  const isUova = haUova && ing.id === uovaIng.id
                  if (isUova) return null
                  const qtyCalcolata = scalaQty(ing)
                  const isEditing = editIngId === ing.id && !haUova
                  return (
                    <div key={ing.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F0EBE3' }}>
                      <span style={{ flex:1, fontSize:14, color:'#1C1C1E', display:'flex', alignItems:'center', gap:6 }}>
                        {ing.nome}
                        {ingredientiUsati[ing.id] && <span title="Usato nel procedimento" style={{ fontSize:11, color:'#8FA88F' }}>✓ usato</span>}
                      </span>
                      {isEditing ? (
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <input autoFocus value={qtyOverride[ing.id] ?? String(qtyCalcolata ?? '')}
                            onChange={e => {
                              const val = e.target.value
                              setQtyOverride({ [ing.id]: val })
                              const newVal = parseFloat(val)
                              if (!isNaN(newVal) && newVal > 0 && ing.quantita) {
                                setCucinaBase({ ingId: ing.id, ratio: newVal / ing.quantita })
                              }
                            }}
                            onFocus={e => e.target.select()}
                            onBlur={() => setEditIngId(null)}
                            onKeyDown={e => e.key === 'Enter' && setEditIngId(null)}
                            style={{ width:60, background:'#EEEAE3', border:'none', borderRadius:8, padding:'4px 8px', fontSize:13, fontFamily:'Georgia,serif', textAlign:'center', outline:'none', color:'#1C1C1E', fontWeight:'bold' }}
                          />
                          <span style={{ fontSize:12, color:'#888' }}>{formattaUnita(ing.unita, qtyOverride[ing.id] ?? qtyCalcolata)}</span>
                        </div>
                      ) : (
                        <span onClick={() => { if (!haUova && ing.quantita) setEditIngId(ing.id) }}
                          style={{ fontSize:14, fontWeight:'bold', color: cucinaBase?.ingId === ing.id ? '#E76F51' : scalato ? '#F4A261' : '#1C1C1E', cursor: !haUova && ing.quantita ? 'pointer' : 'default', borderBottom: !haUova && ing.quantita ? '1px dashed #F4A261' : 'none', paddingBottom:1 }}>
                          {qtyCalcolata ?? '—'} {formattaUnita(ing.unita, qtyCalcolata)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ── PROCEDIMENTO ── */}
        {tab === 'procedimento' && (
          <div>
            {passi.length === 0 && <div style={{ color:'#A8A8A0', fontSize:13, textAlign:'center', padding:'20px 0' }}>Nessun passo inserito.</div>}
            {ingredienti.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FFF8F2', borderRadius:12, padding:'10px 14px', marginBottom:14, border:'1px solid #F4E0CC' }}>
                <span style={{ fontSize:12, color:'#C96B2A' }}>Tocca un ingrediente evidenziato per segnarlo come usato</span>
                <span style={{ fontSize:13, fontWeight:'bold', color:'#C96B2A', whiteSpace:'nowrap', marginLeft:10 }}>{nIngredientiUsati}/{ingredienti.length}</span>
              </div>
            )}
            {passi.map((passo, idx) => {
              const isSelezionato = passoAttivo === passo.id
              const isTimerAttivo = activeTimer?.passo === idx+1
              const minuti = passo.timer_secondi ? Math.round(passo.timer_secondi / 60) : null
              return (
                <div key={passo.id} onClick={() => setPassoAttivo(passo.id)} style={{ background: isSelezionato?'#1C1C1E':'#EEEAE3', borderRadius:16, padding:'14px', marginBottom:12, border: isTimerAttivo?'2px solid #F4A261':'2px solid transparent', cursor:'pointer', transition:'all 0.2s' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ background: isTimerAttivo||isSelezionato?'#F4A261':'#1C1C1E', color:'#fff', borderRadius:'50%', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:'bold', flexShrink:0, marginTop:2 }}>{idx+1}</div>
                    <p style={{ flex:1, fontSize:13, lineHeight:1.6, color: isSelezionato?'#FDFAF6':'#1C1C1E', margin:0 }}>{procedimentoEvidenziato[idx]}</p>
                  </div>
                  {/* Foto del passo (da import URL) */}
                  {(passo.foto_urls?.length ? passo.foto_urls : (passo.foto_url ? [passo.foto_url] : [])).map((url, fi) => (
                    <img key={fi} src={url} alt={`Passo ${idx+1} foto ${fi+1}`} style={{ width:'100%', borderRadius:10, marginTop:10, objectFit:'cover', maxHeight:180 }} />
                  ))}
                  {minuti && (
                    <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
                      <button onClick={e => { e.stopPropagation(); avviaTimer(passo) }} style={{ background: isTimerAttivo?'#F4A261':isSelezionato?'rgba(255,255,255,0.15)':'rgba(0,0,0,0.12)', color: isSelezionato?'#fff':'#1C1C1E', border:'none', borderRadius:20, padding:'6px 14px', fontSize:12, fontFamily:'Georgia,serif', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                        ⏱ {minuti} min
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {ricetta.note && (
              <div style={{ background:'#FFF8F2', borderRadius:14, padding:'14px', border:'1px solid #F4E0CC', marginTop:8 }}>
                <div style={{ fontSize:10, letterSpacing:2, color:'#C96B2A', textTransform:'uppercase', marginBottom:6 }}>Note</div>
                <div style={{ fontSize:13, color:'#1C1C1E', lineHeight:1.6 }}>{ricetta.note}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar — solo tab ingredienti in modalità spesa */}
      {tab === 'ingredienti' && modalita === 'spesa' && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#FDFAF6', borderTop:'1px solid #E8E3DC', padding:'12px 18px 28px', zIndex:100 }}>
          <button onClick={() => setMostraSpesa(true)} style={{ width:'100%', background:'#1C1C1E', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            🛒 Lista della spesa
            {daAcquistare.length > 0 && (
              <span style={{ background:'#F4A261', color:'#fff', borderRadius:20, padding:'2px 8px', fontSize:11 }}>{daAcquistare.length}</span>
            )}
          </button>
        </div>
      )}

      {tab === 'ingredienti' && modalita === 'cucina' && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#FDFAF6', borderTop:'1px solid #E8E3DC', padding:'12px 18px 28px', zIndex:100 }}>
          <div style={{ textAlign:'center', fontSize:12, color:'#888', fontFamily:'Georgia,serif' }}>
            Tap sulla quantità per modificarla
          </div>
        </div>
      )}
    </div>
  )
}
