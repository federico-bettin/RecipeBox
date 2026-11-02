import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizzaIngrediente } from '../lib/ingredienti'

const SUPABASE_URL = 'https://omyieafskwzcnskokerv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teWllYWZza3d6Y25za29rZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzMxNzUsImV4cCI6MjA5NjY0OTE3NX0.Mj7kLIltASK7rrIJOUOXV5a4D-2HgxqmKhbXb7LVRys'

async function callEdgeFunction(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `Errore ${res.status}`)
  }
  return res.json()
}

const INGREDIENTI_COMUNI = [
  "Acqua","Aglio","Basilico","Burro","Cannella","Capperi","Carota","Cipolla",
  "Farina","Farina 00","Farina integrale","Farina di mais","Latte","Lievito","Limone","Mozzarella",
  "Olio di oliva","Olio EVO","Olio di semi di girasole","Origano","Parmigiano","Passata di pomodoro",
  "Pecorino","Pepe nero","Pomodori","Prezzemolo","Prosciutto cotto",
  "Prosciutto crudo","Ricotta","Rosmarino","Sale","Sedano","Uova","Zucchero",
  "Zucchero a velo","Zucchero a velo vanigliato","Aceto balsamico","Brodo vegetale","Brodo di carne",
  "Pancetta","Guanciale","Vino bianco","Vino rosso","Panna","Piselli",
  "Spinaci","Patate","Riso","Pasta","Spaghetti","Cioccolato fondente",
  "Mandorle","Noci","Pinoli","Uvetta","Vanillina","Vaniglia in bacca",
  "Granella di nocciole","Granella di mandorle","Fecola di patate",
]
const CATEGORIE = ["Antipasti","Primi","Secondi","Contorni","Dessert","Cocktail"]
const DIETE     = ["Vegano","Vegetariano","Senza glutine","Senza lattosio"]
const UNITA     = ["g","kg","ml","l","cucchiaio","cucchiaino","tazza","bustina","pizzico","stecca","rametto","foglia","q.b."]

const inp = { background:'#EEEAE3', border:'none', borderRadius:10, padding:'9px 12px', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', outline:'none' }
const lbl = { fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:6, display:'block' }

// ─── RIGA INGREDIENTE con autocomplete + scaling parziale ─────────────────────
function IngRow({ ing, onChange, onRemove }) {
  const [query, setQuery]             = useState(ing.nome)
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]               = useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleInput = val => {
    setQuery(val); onChange({ ...ing, nome: val, nome_generico: null })
    if (val.length >= 2) {
      const f = INGREDIENTI_COMUNI.filter(i => i.toLowerCase().startsWith(val.toLowerCase())).slice(0, 6)
      setSuggestions(f); setOpen(f.length > 0)
    } else setOpen(false)
  }

  const select = val => { setQuery(val); onChange({ ...ing, nome: val, nome_generico: null }); setOpen(false) }

  return (
    <div style={{ marginBottom:10 }}>
      <div className="ing-row" style={{ display:'flex', gap:6, alignItems:'center' }}>
        {/* Nome con autocomplete */}
        <div style={{ flex:1, position:'relative' }} ref={ref}>
          <input value={query} onChange={e => handleInput(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(suggestions.length > 0)}
            placeholder="Ingrediente"
            style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
          {open && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', borderRadius:10, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', overflow:'hidden', border:'1px solid #E8E3DC', marginTop:4 }}>
              {suggestions.map((s, i) => (
                <div key={i} onMouseDown={() => select(s)}
                  style={{ padding:'9px 14px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', borderBottom: i < suggestions.length-1 ? '1px solid #F0EBE3':'none' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F7F4F0'}
                  onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quantità — null se q.b. */}
        <input
          value={ing.unita === 'q.b.' ? '' : (ing.quantita || '')}
          onChange={e => onChange({ ...ing, quantita: e.target.value })}
          onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.closest('.ing-row').querySelector('select').focus() }}}
          placeholder=""
          disabled={ing.unita === 'q.b.'}
          style={{ ...inp, width:50, textAlign:'center', opacity: ing.unita === 'q.b.' ? 0.4 : 1 }} />

        {/* Unità — opzione vuota = null */}
        <select value={ing.unita || ''} onChange={e => {
          const val = e.target.value
          onChange({ ...ing, unita: val || null, quantita: val === 'q.b.' ? '' : ing.quantita })
        }} style={{ ...inp, width:80, cursor:'pointer' }}>
          <option value="">—</option>
          {UNITA.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        {/* Rimuovi */}
        <button onClick={onRemove} style={{ background:'none', border:'none', color:'#E76F51', fontSize:18, cursor:'pointer', padding:'0 2px', flexShrink:0 }}>✕</button>
      </div>
    </div>
  )
}

// ─── MODAL IMPORT ─────────────────────────────────────────────────────────────
function ModalImport({ onClose, onImported, modoIniziale }) {
  const [modo, setModo]         = useState(modoIniziale === 'url' ? 'url' : null)
  const [url, setUrl]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [errore, setErrore]     = useState('')
  const importCameraRef         = useRef()
  const importFileRef           = useRef()

  // Se modoIniziale è camera o file, apri subito il file picker
  useEffect(() => {
    if (modoIniziale === 'camera') {
      setModo('camera')
      setTimeout(() => importCameraRef.current?.click(), 100)
    } else if (modoIniziale === 'file') {
      setModo('file')
      setTimeout(() => importFileRef.current?.click(), 100)
    }
  }, [])

  const mappaErroreImportUrl = (msg) => {
    if (!msg) return 'Importazione non riuscita. Riprova.'
    if (msg.includes('BLOCKED')) return 'Il sito ha bloccato la richiesta (protezione anti-bot). Prova con "Fotografa" o "Importa da file" invece.'
    if (msg.startsWith('HTTP_')) return `Il sito ha risposto con un errore (${msg.replace('HTTP_', '')}). Verifica che il link sia corretto.`
    if (msg.includes('non leggibile')) return 'Non sono riuscito a leggere il contenuto della pagina. Verifica che il link porti davvero a una ricetta.'
    if (msg.includes('JSON') || msg.includes('Claude')) return 'Non sono riuscito a interpretare correttamente i dati della ricetta. Riprova, oppure inseriscila manualmente.'
    return msg
  }

  const handleUrl = async () => {
    if (!url.trim()) return
    setLoading(true); setErrore('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const data = await callEdgeFunction('import-url', { url: url.trim(), user_id: user?.id })
      onImported(data)
    } catch (e) {
      setErrore(mappaErroreImportUrl(e.message))
    }
    setLoading(false)
  }

  const handleFileOCR = async (file) => {
    if (!file) return
    setLoading(true); setErrore('')
    try {
      // Converti immagine in base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      // Chiamata Google Vision API via edge function
      const data = await callEdgeFunction('ocr-recipe', { image: base64, mimeType: file.type })
      onImported(data)
    } catch (e) {
      setErrore('Impossibile leggere la ricetta. Riprova con un\'immagine più nitida.')
    }
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div style={{ background:'#FDFAF6', borderRadius:'24px 24px 0 0', width:'100%', padding:'16px 18px 40px', boxShadow:'0 -8px 32px rgba(0,0,0,0.15)' }}>
        {/* Maniglia */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <div style={{ width:36, height:4, background:'#DDDAD5', borderRadius:2 }} />
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:'bold', color:'#1C1C1E', fontFamily:'Georgia,serif' }}>Importa ricetta</div>
          <button onClick={onClose} style={{ background:'#EEEAE3', border:'none', borderRadius:'50%', width:28, height:28, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#888' }}>✕</button>
        </div>

        {!modo ? (
          /* Selezione modalità */
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={() => setModo('url')} style={{ background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:'Georgia,serif', textAlign:'left' }}>
              <span style={{ fontSize:22 }}>🔗</span>
              <div>
                <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E' }}>Da URL</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Incolla il link di una ricetta web</div>
              </div>
            </button>
            <button onClick={() => { setModo('camera'); setTimeout(() => importCameraRef.current?.click(), 100) }}
              style={{ background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:'Georgia,serif', textAlign:'left' }}>
              <span style={{ fontSize:22 }}>📷</span>
              <div>
                <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E' }}>Fotocamera</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Scatta una foto alla ricetta</div>
              </div>
            </button>
            <button onClick={() => { setModo('file'); setTimeout(() => importFileRef.current?.click(), 100) }}
              style={{ background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:'Georgia,serif', textAlign:'left' }}>
              <span style={{ fontSize:22 }}>📄</span>
              <div>
                <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E' }}>File immagine</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Seleziona foto dalla galleria o dal cloud</div>
              </div>
            </button>
          </div>
        ) : modo === 'url' ? (
          /* Input URL */
          <div>
            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8 }}>URL ricetta</div>
            <div style={{ background:'#EEEAE3', borderRadius:12, display:'flex', alignItems:'center', padding:'10px 14px', gap:8, marginBottom:12 }}>
              <span style={{ color:'#A8A8A0', fontSize:14 }}>🔗</span>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                autoFocus
                style={{ background:'transparent', border:'none', outline:'none', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', flex:1 }} />
              {url && <span onClick={() => setUrl('')} style={{ color:'#A8A8A0', cursor:'pointer' }}>✕</span>}
            </div>
            {errore && <div style={{ fontSize:12, color:'#E76F51', marginBottom:10, fontFamily:'Georgia,serif' }}>{errore}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setModo(null); setErrore('') }} style={{ flex:1, background:'#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E' }}>Indietro</button>
              <button onClick={handleUrl} disabled={loading || !url.trim()} style={{ flex:2, background: url.trim() ? '#1C1C1E' : '#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor: url.trim() ? 'pointer' : 'default', fontFamily:'Georgia,serif', color: url.trim() ? '#FDFAF6' : '#AAA', fontWeight:'bold' }}>
                {loading ? '⏳ Importando...' : 'Importa'}
              </button>
            </div>
          </div>
        ) : (
          /* OCR in corso */
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            {loading ? (
              <>
                <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:14, color:'#888' }}>Lettura in corso...</div>
              </>
            ) : errore ? (
              <>
                <div style={{ fontSize:12, color:'#E76F51', marginBottom:16, fontFamily:'Georgia,serif' }}>{errore}</div>
                <button onClick={() => { setModo(null); setErrore('') }} style={{ background:'#EEEAE3', border:'none', borderRadius:14, padding:'12px 24px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif' }}>Riprova</button>
              </>
            ) : null}
          </div>
        )}

        {/* Input nascosti modal import */}
        <input ref={importCameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
          onChange={e => handleFileOCR(e.target.files[0])} />
        <input ref={importFileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }}
          onChange={e => handleFileOCR(e.target.files[0])} />
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function FormRicetta() {
  const navigate   = useNavigate()
  const { id }     = useParams()
  const location   = useLocation()
  const isEdit     = !!id
  const nextId     = useRef(100)

  const importParam = new URLSearchParams(location.search).get('import')
  const [showImport,  setShowImport]  = useState(!!importParam)
  const [modoImportIniziale]          = useState(importParam || null)
  const fileInputRef = useRef()

  const [titolo,      setTitolo]      = useState('')
  const [categoria,   setCategoria]   = useState('Primi')
  const [tempoPrep,   setTempoPrep]   = useState('')
  const [tempo,       setTempo]       = useState('')
  const [tempoRiposo, setTempoRiposo] = useState('')
  const [tempoTotale, setTempoTotale] = useState('')
  const [difficolta,  setDifficolta]  = useState('')
  const [porzioniBase, setPorzioniBase] = useState('')
  const [diete,       setDiete]       = useState([])
  const [note,        setNote]        = useState('')
  const [utensili,    setUtensili]    = useState([])
  const [ingredienti, setIngredienti] = useState([{ id:1, nome:'', quantita:'', unita:'' }])
  const [passi,       setPassi]       = useState([{ id:1, testo:'', timer_secondi:'', foto_urls:[] }])
  const [fotoFile,       setFotoFile]       = useState(null)
  const [fotoPreview,    setFotoPreview]    = useState(null)
  const [fotoUrl,        setFotoUrl]        = useState(null)    // URL già salvato su Supabase Storage
  const [fotoUrlEsterna, setFotoUrlEsterna] = useState(null)    // URL esterno da import (og:image)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  // Carica ricetta in modifica
  useEffect(() => {
    if (!isEdit) return
    const load = async () => {
      const { data: r } = await supabase.from('recipes').select('*').eq('id', id).single()
      if (!r) return
      setTitolo(r.titolo); setCategoria(r.categoria)
      setTempoPrep(r.tempo_preparazione_minuti ? String(r.tempo_preparazione_minuti) : '')
      setTempo(r.tempo_minuti ? String(r.tempo_minuti) : '')
      setTempoRiposo(r.tempo_riposo_minuti ? String(r.tempo_riposo_minuti) : '')
      setTempoTotale(r.tempo_totale_minuti ? String(r.tempo_totale_minuti) : '')
      setDifficolta(r.difficolta || ''); setDiete(r.diete || [])
      setPorzioniBase(r.porzioni_base ? String(r.porzioni_base) : '')
      setNote(r.note || ''); setFotoUrl(r.foto_url || null)
      setUtensili(r.utensili || [])
      const { data: ings } = await supabase.from('ingredients').select('*').eq('recipe_id', id).order('ordine')
      if (ings) setIngredienti(ings.map(i => ({ id:i.id, nome:i.nome, nome_generico:i.nome_generico||null, quantita: i.quantita ? String(i.quantita):'', unita:i.unita||'' })))
      const { data: steps } = await supabase.from('steps').select('*').eq('recipe_id', id).order('ordine')
      if (steps) setPassi(steps.map(s => ({
        id:s.id, testo:s.testo, timer_secondi: s.timer_secondi ? String(s.timer_secondi):'',
        foto_urls: (s.foto_urls && s.foto_urls.length) ? s.foto_urls : (s.foto_url ? [s.foto_url] : []),
      })))
    }
    load()
  }, [id])

  // Gestione foto
  const handleFotoChange = e => {
    const file = e.target.files[0]; if (!file) return
    setFotoFile(file)
    // FileReader più compatibile di createObjectURL su mobile/PWA
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }
  const rimuoviFoto = () => {
    setFotoFile(null); setFotoPreview(null); setFotoUrl(null); setFotoUrlEsterna(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Ingredienti
  const addIng         = () => setIngredienti(prev => [...prev, { id: nextId.current++, nome:'', quantita:'', unita:'' }])
  const updIng         = (iId, data) => setIngredienti(prev => prev.map(i => i.id === iId ? { ...i, ...data } : i))
  const remIng         = iId => setIngredienti(prev => prev.filter(i => i.id !== iId))

  // Passi
  const addPasso = () => setPassi(prev => [...prev, { id: nextId.current++, testo:'', timer_secondi:'', foto_urls:[] }])
  const updPasso = (pId, data) => setPassi(prev => prev.map(p => p.id === pId ? { ...p, ...data } : p))
  // Usano l'updater funzionale di setPassi (non il valore "passo" catturato nella closure)
  // così, caricando più foto insieme, ogni FileReader che si risolve in ordine sparso
  // aggiunge la propria foto senza sovrascrivere quelle già aggiunte dagli altri.
  const addFotoPasso    = (pId, url) => setPassi(prev => prev.map(p => p.id === pId ? { ...p, foto_urls: [...(p.foto_urls||[]), url] } : p))
  const removeFotoPasso = (pId, idx) => setPassi(prev => prev.map(p => p.id === pId ? { ...p, foto_urls: (p.foto_urls||[]).filter((_,i) => i !== idx) } : p))
  const remPasso = pId => setPassi(prev => prev.filter(p => p.id !== pId))
  const spostaPasso = (idx, direzione) => setPassi(prev => {
    const nuovoIdx = idx + direzione
    if (nuovoIdx < 0 || nuovoIdx >= prev.length) return prev
    const copia = [...prev]
    ;[copia[idx], copia[nuovoIdx]] = [copia[nuovoIdx], copia[idx]]
    return copia
  })
  const toggleDieta = d => setDiete(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  // Import da URL/OCR → popola form
  const handleImported = (data) => {
    setShowImport(false)
    if (data.titolo)    setTitolo(data.titolo)
    if (data.categoria) setCategoria(data.categoria)
    if (data.tempo_preparazione_minuti) setTempoPrep(String(data.tempo_preparazione_minuti))
    if (data.tempo_minuti) setTempo(String(data.tempo_minuti))
    if (data.tempo_riposo_minuti) setTempoRiposo(String(data.tempo_riposo_minuti))
    if (data.tempo_totale_minuti) setTempoTotale(String(data.tempo_totale_minuti))
    if (data.difficolta)   setDifficolta(data.difficolta)
    if (data.porzioni_base) setPorzioniBase(String(data.porzioni_base))
    if (data.note)         setNote(data.note)
    if (data.utensili?.length) setUtensili(data.utensili)
    // Foto dalla pagina (og:image)
    if (data.foto_url) setFotoUrlEsterna(data.foto_url)
    if (data.ingredienti?.length) {
      setIngredienti(data.ingredienti.map((ing) => ({
        id: nextId.current++, nome: ing.nome || '', quantita: ing.quantita ? String(ing.quantita) : '',
        unita: ing.unita || '',
      })))
    }
    if (data.passi?.length) {
      setPassi(data.passi.map((p) => ({
        id: nextId.current++, testo: p.testo || '', timer_secondi: p.timer_secondi ? String(p.timer_secondi) : '',
        foto_urls: p.foto_url ? [p.foto_url] : [],
      })))
    }
  }

  // Calcola i nomi "generici" degli ingredienti tramite Claude (per il filtro di
  // ricerca). Se la chiamata fallisce per qualsiasi motivo, non blocca il
  // salvataggio: l'app userà comunque un'euristica locale come ripiego.
  const calcolaNomiGenerici = async (nomi, userId) => {
    if (!nomi.length) return nomi.map(() => null)
    try {
      const data = await callEdgeFunction('nome-generico-ingredienti', { nomi, user_id: userId })
      if (Array.isArray(data.generici) && data.generici.length === nomi.length) return data.generici
    } catch (e) {
      console.warn('Calcolo nome generico ingredienti non riuscito:', e)
    }
    return nomi.map(() => null)
  }

  // Salva
  const salva = async () => {
    if (!titolo.trim()) { setError('Inserisci il nome della ricetta.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()

    // Priorità: nuovo file > foto_url già salvata (include quella uploadata dalla edge function)
    let finalFotoUrl = fotoUrlEsterna || fotoUrl
    if (fotoFile) {
      const ext  = fotoFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('recipe-photos').upload(path, fotoFile)
      if (upErr) { setError('Errore upload foto: ' + upErr.message); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('recipe-photos').getPublicUrl(path)
      finalFotoUrl = urlData.publicUrl
    }

    // Upload delle foto dei singoli passi: ogni passo può averne più di una.
    // Le anteprime locali (data URL base64) vanno caricate su Storage prima
    // di salvare; quelle già pubbliche (da import o già salvate) restano invariate.
    let passiConFotoCaricate
    try {
      passiConFotoCaricate = await Promise.all(passi.map(async (p) => {
        const urls = await Promise.all((p.foto_urls || []).map(async (fotoUrlPasso) => {
          if (fotoUrlPasso && fotoUrlPasso.startsWith('data:')) {
            const blob = await (await fetch(fotoUrlPasso)).blob()
            const ext  = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
            const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}_passo.${ext}`
            const { error: upErr } = await supabase.storage.from('recipe-photos').upload(path, blob)
            if (upErr) throw upErr
            const { data: urlData } = supabase.storage.from('recipe-photos').getPublicUrl(path)
            return urlData.publicUrl
          }
          return fotoUrlPasso
        }))
        return { ...p, foto_urls: urls }
      }))
    } catch (e) {
      setError('Errore upload foto del passo: ' + e.message)
      setSaving(false)
      return
    }

    const recipeData = {
      user_id: user.id, titolo: titolo.trim(), categoria,
      tempo_preparazione_minuti: tempoPrep ? parseInt(tempoPrep) : null,
      tempo_minuti: tempo ? parseInt(tempo) : null,
      tempo_riposo_minuti: tempoRiposo ? parseInt(tempoRiposo) : null,
      tempo_totale_minuti: tempoTotale
        ? parseInt(tempoTotale)
        : ((tempoPrep || tempo || tempoRiposo)
            ? (parseInt(tempoPrep||0,10) + parseInt(tempo||0,10) + parseInt(tempoRiposo||0,10))
            : null),
      difficolta: difficolta || null, diete, note: note || null,
      utensili: utensili.filter(u => u.trim()).length ? utensili.filter(u => u.trim()) : null,
      porzioni_base: porzioniBase ? parseInt(porzioniBase, 10) : null,
      foto_url: finalFotoUrl || null,
      is_pubblica: true, fonte_tipo: 'manuale',
    }

    let recipeId = id
    if (isEdit) {
      const { error: e } = await supabase.from('recipes').update(recipeData).eq('id', id)
      if (e) { setError(e.message); setSaving(false); return }
      await supabase.from('ingredients').delete().eq('recipe_id', id)
      await supabase.from('steps').delete().eq('recipe_id', id)
    } else {
      const { data, error: e } = await supabase.from('recipes').insert(recipeData).select().single()
      if (e) { setError(e.message); setSaving(false); return }
      recipeId = data.id
    }

    const ingredientiValidi = ingredienti.filter(i => i.nome.trim())
    const nomiNormalizzati  = ingredientiValidi.map(i => normalizzaIngrediente(i.nome))

    // Chiama Claude solo per gli ingredienti nuovi o il cui nome è stato modificato
    // (nome_generico viene azzerato in IngRow non appena il testo cambia). Per tutti
    // gli altri riusiamo il valore già calcolato in un salvataggio precedente: zero
    // chiamate API se stai modificando solo titolo, tempi, note, ecc.
    const daCalcolare = []
    ingredientiValidi.forEach((i, idx) => { if (!i.nome_generico) daCalcolare.push(idx) })

    const nomiGenerici = ingredientiValidi.map(i => i.nome_generico || null)
    if (daCalcolare.length) {
      const nomiDaCalcolare = daCalcolare.map(idx => nomiNormalizzati[idx])
      const calcolati = await calcolaNomiGenerici(nomiDaCalcolare, user.id)
      daCalcolare.forEach((idx, i) => { nomiGenerici[idx] = calcolati[i] || null })
    }

    const ingsToInsert = ingredientiValidi.map((i, idx) => ({
      recipe_id: recipeId,
      nome: nomiNormalizzati[idx],
      nome_generico: nomiGenerici[idx],
      quantita: i.quantita ? parseFloat(i.quantita) : null,
      unita: i.unita || null,
      ordine: idx,
    }))
    if (ingsToInsert.length) await supabase.from('ingredients').insert(ingsToInsert)

    const passiToInsert = passiConFotoCaricate
      .filter(p => p.testo.trim())
      .map((p, idx) => ({
        recipe_id: recipeId, testo: p.testo.trim(),
        timer_secondi: p.timer_secondi ? parseInt(p.timer_secondi) : null, ordine: idx,
        foto_urls: p.foto_urls || [],
        foto_url: (p.foto_urls && p.foto_urls[0]) || null, // legacy, per compatibilità
      }))
    if (passiToInsert.length) await supabase.from('steps').insert(passiToInsert)

    setSaving(false)
    navigate('/', { replace: true })
  }

  // fotoSrc: priorità anteprima locale > URL esterna import > URL salvata su storage
  const fotoSrc = fotoPreview || fotoUrlEsterna || fotoUrl

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Modal import */}
      {showImport && <ModalImport onClose={() => setShowImport(false)} onImported={handleImported} modoIniziale={modoImportIniziale} />}

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 20px 18px', color:'#FDFAF6', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <button onClick={() => navigate(-1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:34, height:34, color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>‹</button>
        <span style={{ fontSize:18, fontWeight:'bold', flex:1 }}>{isEdit ? 'Modifica ricetta' : 'Nuova ricetta'}</span>
        {/* Pulsante importa — solo nuova ricetta */}
        {!isEdit && (
          <button onClick={() => setShowImport(true)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'7px 12px', color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', whiteSpace:'nowrap' }}>
            ↓ Importa
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 100px' }}>

        {/* FOTO */}
        <div style={{ marginBottom:16 }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFotoChange} />
          {fotoSrc ? (
            <div style={{ position:'relative', borderRadius:16, overflow:'hidden', height:160 }}>
              <img src={fotoSrc} alt="Foto ricetta" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <button onClick={rimuoviFoto} style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', border:'none', borderRadius:'50%', width:30, height:30, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              <button onClick={() => fileInputRef.current?.click()} style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,0.6)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif' }}>Cambia foto</button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} style={{ background:'#EEEAE3', border:'2px dashed #D8D3CB', borderRadius:16, height:100, width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:6 }}>
              <span style={{ fontSize:28 }}>📸</span>
              <span style={{ fontSize:12, color:'#A8A8A0', fontFamily:'Georgia,serif' }}>Aggiungi foto</span>
            </button>
          )}
        </div>

        {/* Nome */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Nome ricetta</label>
          <input value={titolo} onChange={e => setTitolo(e.target.value)}
            placeholder="Es. Lasagna della nonna"
            style={{ ...inp, width:'100%', boxSizing:'border-box', fontSize:15 }} />
        </div>

        {/* Categoria */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Categoria</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {CATEGORIE.map(c => (
              <button key={c} onClick={() => setCategoria(c)} style={{
                background: categoria===c ? '#1C1C1E' : '#EEEAE3',
                color: categoria===c ? '#fff' : '#1C1C1E',
                border:'none', borderRadius:20, padding:'6px 14px',
                fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', transition:'all 0.15s',
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Tempi */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Tempi (minuti)</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:10, color:'#A8A8A0', marginBottom:4 }}>Preparazione</div>
              <input value={tempoPrep} onChange={e => setTempoPrep(e.target.value)}
                type="number" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize:10, color:'#A8A8A0', marginBottom:4 }}>Cottura</div>
              <input value={tempo} onChange={e => setTempo(e.target.value)}
                type="number" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize:10, color:'#A8A8A0', marginBottom:4 }}>Riposo</div>
              <input value={tempoRiposo} onChange={e => setTempoRiposo(e.target.value)}
                type="number" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize:10, color:'#A8A8A0', marginBottom:4 }}>Totale</div>
              <input value={tempoTotale} onChange={e => setTempoTotale(e.target.value)} placeholder="Auto"
                type="number" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
            </div>
          </div>
          <div style={{ fontSize:11, color:'#A8A8A0', marginTop:6 }}>Lascia "Totale" vuoto per calcolarlo automaticamente dagli altri tre</div>
        </div>

        {/* Porzioni base + Difficoltà */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Porzioni base</label>
            <input value={porzioniBase} onChange={e => setPorzioniBase(e.target.value)} placeholder="Es. 4"
              type="number" min="1" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:1 }}>
            <label style={lbl}>Difficoltà</label>
            <select value={difficolta} onChange={e => setDifficolta(e.target.value)}
              style={{ ...inp, width:'100%', boxSizing:'border-box', cursor:'pointer' }}>
              <option value="">—</option>
              <option>Facile</option><option>Media</option><option>Difficile</option>
            </select>
          </div>
        </div>

        {/* Dieta */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Filtri dieta</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {DIETE.map(d => (
              <button key={d} onClick={() => toggleDieta(d)} style={{
                background: diete.includes(d) ? '#1C1C1E' : '#EEEAE3',
                color: diete.includes(d) ? '#fff' : '#1C1C1E',
                border:'none', borderRadius:20, padding:'6px 12px',
                fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif', transition:'all 0.15s',
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Ingredienti */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Ingredienti</label>

          {ingredienti.map(ing => (
            <IngRow key={ing.id} ing={ing}
              onChange={data => updIng(ing.id, data)}
              onRemove={() => remIng(ing.id)}
            />
          ))}
          <button onClick={addIng} style={{ background:'#EEEAE3', border:'none', borderRadius:10, padding:'8px 16px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', marginTop:4 }}>
            + Aggiungi ingrediente
          </button>
        </div>

        {/* Procedimento */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Procedimento</label>
          {passi.map((passo, idx) => (
            <div key={passo.id} style={{ display:'flex', gap:8, marginBottom:12, alignItems:'flex-start' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0, marginTop:4 }}>
                <button onClick={() => spostaPasso(idx, -1)} disabled={idx === 0}
                  style={{ background:'none', border:'none', color: idx===0 ? '#DDD' : '#888', fontSize:14, cursor: idx===0 ? 'default' : 'pointer', padding:0, lineHeight:1 }}>▲</button>
                <div style={{ background:'#1C1C1E', color:'#fff', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>{idx+1}</div>
                <button onClick={() => spostaPasso(idx, 1)} disabled={idx === passi.length - 1}
                  style={{ background:'none', border:'none', color: idx===passi.length-1 ? '#DDD' : '#888', fontSize:14, cursor: idx===passi.length-1 ? 'default' : 'pointer', padding:0, lineHeight:1 }}>▼</button>
              </div>
              <div style={{ flex:1 }}>
                <textarea value={passo.testo} onChange={e => updPasso(passo.id, { testo: e.target.value })}
                  placeholder={`Descrivi il passo ${idx+1}...`}
                  style={{ ...inp, width:'100%', boxSizing:'border-box', height:60, resize:'vertical' }} />
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                  <span style={{ fontSize:11, color:'#A8A8A0' }}>⏱ Timer (min):</span>
                  <input
                    value={passo.timer_secondi ? String(Math.round(passo.timer_secondi / 60)) : ''}
                    onChange={e => {
                      const min = e.target.value
                      updPasso(passo.id, { timer_secondi: min ? String(parseInt(min, 10) * 60) : '' })
                    }}
                    placeholder="" type="number"
                    style={{ ...inp, width:70, padding:'4px 8px', fontSize:12 }} />
                </div>
                {(passo.foto_urls||[]).length > 0 && (
                  <div style={{ display:'flex', gap:6, overflowX:'auto', marginTop:6, paddingBottom:2 }}>
                    {passo.foto_urls.map((url, fi) => (
                      <div key={fi} style={{ position:'relative', flexShrink:0 }}>
                        <img src={url} alt="" style={{ width:80, height:80, borderRadius:8, objectFit:'cover' }} />
                        <button onClick={() => removeFotoPasso(passo.id, fi)}
                          style={{ position:'absolute', top:3, right:3, background:'rgba(0,0,0,0.6)', border:'none', borderRadius:'50%', width:20, height:20, color:'#fff', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <label style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:6, cursor:'pointer' }}>
                  <input type="file" accept="image/*" multiple style={{ display:'none' }}
                    onChange={e => {
                      const files = Array.from(e.target.files || [])
                      files.forEach(file => {
                        const reader = new FileReader()
                        reader.onload = ev => addFotoPasso(passo.id, ev.target.result)
                        reader.readAsDataURL(file)
                      })
                      e.target.value = '' // permette di riselezionare le stesse foto in seguito
                    }} />
                  <span style={{ background:'#EEEAE3', borderRadius:8, padding:'4px 10px', fontSize:11, color:'#888', fontFamily:'Georgia,serif' }}>
                    📷 {(passo.foto_urls||[]).length > 0 ? 'Aggiungi altra foto' : 'Foto passo'}
                  </span>
                </label>
              </div>
              {passi.length > 1 && (
                <button onClick={() => remPasso(passo.id)} style={{ background:'none', border:'none', color:'#E76F51', fontSize:18, cursor:'pointer', marginTop:6 }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={addPasso} style={{ background:'#EEEAE3', border:'none', borderRadius:10, padding:'8px 16px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E' }}>
            + Aggiungi passo
          </button>
        </div>

        {/* Utensili */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Utensili necessari</label>
          {utensili.map((u, idx) => (
            <div key={idx} style={{ display:'flex', gap:6, marginBottom:8 }}>
              <input value={u} onChange={e => setUtensili(prev => prev.map((x,i) => i===idx ? e.target.value : x))}
                placeholder="Es. Frusta elettrica"
                style={{ ...inp, flex:1, boxSizing:'border-box' }} />
              <button onClick={() => setUtensili(prev => prev.filter((_,i) => i!==idx))}
                style={{ background:'none', border:'none', color:'#E76F51', fontSize:18, cursor:'pointer', padding:'0 2px', flexShrink:0 }}>✕</button>
            </div>
          ))}
          <button onClick={() => setUtensili(prev => [...prev, ''])} style={{ background:'#EEEAE3', border:'none', borderRadius:10, padding:'8px 16px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E' }}>
            + Aggiungi utensile
          </button>
        </div>

        {/* Note */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Varianti, consigli, abbinamenti..."
            style={{ ...inp, width:'100%', boxSizing:'border-box', height:70, resize:'vertical' }} />
        </div>

        {error && <div style={{ background:'#FFF0F0', border:'1px solid #FDD', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#E76F51', marginBottom:12 }}>{error}</div>}
      </div>

      {/* Bottom actions */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#FDFAF6', borderTop:'1px solid #E8E3DC', padding:'12px 18px 28px', display:'flex', gap:10, zIndex:100 }}>
        <button onClick={() => navigate(-1)} disabled={saving} style={{ flex:1, background:'#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', fontWeight:'bold' }}>
          Annulla
        </button>
        <button onClick={salva} disabled={saving} style={{ flex:2, background:'#1C1C1E', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6', fontWeight:'bold' }}>
          {saving ? '...' : isEdit ? 'Salva modifiche' : 'Salva ricetta'}
        </button>
      </div>
    </div>
  )
}
