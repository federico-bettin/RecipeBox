import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { nomeGenerico } from '../lib/ingredienti'
import BottomNav from '../components/BottomNav.jsx'

const CATEGORIE_FILTRO  = ["Antipasti","Primi","Secondi","Contorni","Dessert","Cocktail"]
const DIETE_FILTRO      = ["Vegano","Vegetariano","Senza glutine","Senza lattosio"]
const TEMPI_FILTRO      = ["< 15 min","< 30 min","< 60 min","Oltre 60 min"]
const DIFFICOLTA_FILTRO = ["Facile","Media","Difficile"]

const CAT_COLORS = {
  Antipasti: '#2A9D8F', Primi: '#F4A261', Secondi: '#264653',
  Contorni: '#E9C46A', Dessert: '#E76F51', Cocktail: '#457B9D',
}

const pill = (active) => ({
  background: active ? '#1C1C1E' : '#EEEAE3',
  color: active ? '#fff' : '#1C1C1E',
  border: 'none', borderRadius: 20, padding: '7px 14px',
  fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia,serif',
  fontWeight: active ? 'bold' : 'normal', transition: 'all 0.15s',
  whiteSpace: 'nowrap',
})

const tog = (obj, key, val) => {
  const arr = obj[key] || []
  return { ...obj, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
}

function applicaFiltri(ricette, search, filtri, ingredientiRicetteMap, ambito) {
  return ricette.filter(r => {
    if (ambito === 'mie' && !r.mia) return false
    if (ambito === 'base' && !r.is_pubblica) return false
    if (search && !r.titolo.toLowerCase().includes(search.toLowerCase())) return false
    if (filtri.categorie?.length && !filtri.categorie.includes(r.categoria)) return false
    if (filtri.difficolta?.length && !filtri.difficolta.includes(r.difficolta)) return false
    if (filtri.diete?.length && !filtri.diete.every(d => (r.diete || []).includes(d))) return false
    if (filtri.gia_provata && !r.gia_provata) return false
    if (filtri.ingredienti?.length) {
      const genericiRicetta = (ingredientiRicetteMap[r.id] || []).map(x => (x.nome_generico || nomeGenerico(x.nome)).toLowerCase())
      const ok = filtri.ingredienti.every(ing => genericiRicetta.some(n => n.includes(ing.toLowerCase())))
      if (!ok) return false
    }
    if (filtri.tempi?.length) {
      const ok = filtri.tempi.some(t =>
        t === '< 15 min' ? r.tempo_minuti < 15 :
        t === '< 30 min' ? r.tempo_minuti < 30 :
        t === '< 60 min' ? r.tempo_minuti < 60 : r.tempo_minuti >= 60
      )
      if (!ok) return false
    }
    return true
  })
}

export default function Archivio() {
  const navigate = useNavigate()
  const location = useLocation()

  // Legge tutti i parametri URL passati dalla Home
  const urlParams = new URLSearchParams(location.search)
  const catsFromUrl  = urlParams.get('categoria')?.split(',').filter(Boolean) || []
  const ingsFromUrl = urlParams.get('ingredienti')?.split(',').filter(Boolean) || []
  const dieteFromUrl = urlParams.get('diete')?.split(',').filter(Boolean) || []
  const tempiFromUrl = urlParams.get('tempi')?.split(',').filter(Boolean) || []
  const diffFromUrl  = urlParams.get('difficolta')?.split(',').filter(Boolean) || []

  const filtriIniziali = {
    ...(catsFromUrl.length ? { categorie: catsFromUrl } : {}),
    ...(ingsFromUrl.length ? { ingredienti: ingsFromUrl } : {}),
    ...(dieteFromUrl.length ? { diete: dieteFromUrl } : {}),
    ...(tempiFromUrl.length ? { tempi: tempiFromUrl } : {}),
    ...(diffFromUrl.length ? { difficolta: diffFromUrl } : {}),
  }

  const [ricette,              setRicette]              = useState([])
  const [ingredientiMap,       setIngredientiMap]       = useState({}) // { recipe_id: [nome1, nome2] }
  const [tuttiIngredienti,     setTuttiIngredienti]     = useState([])
  const [ingSearch,            setIngSearch]            = useState('')
  const [loading,              setLoading]              = useState(true)
  const [search,               setSearch]               = useState('')
  const [filtriApplicati,      setFiltriApplicati]      = useState(filtriIniziali)
  const [filtriTemp,           setFiltriTemp]           = useState(filtriIniziali)
  const [showFiltri,           setShowFiltri]           = useState(false)
  // Ambito: tutte le ricette visibili, solo le mie, oppure solo la base (pubbliche)
  const ambitoParam = urlParams.get('ambito')
  const [ambito, setAmbito] = useState(['mie', 'base'].includes(ambitoParam) ? ambitoParam : 'tutte')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: ricette } = await supabase.from('recipes').select('*').is('eliminata_il', null).order('created_at', { ascending: false })
      // "Già provata" è personale (tabella recipe_provate); "mia" = creata da me
      const { data: prove } = await supabase.from('recipe_provate').select('recipe_id')
      const provate = new Set((prove || []).map(x => x.recipe_id))
      setRicette((ricette || []).map(r => ({ ...r, gia_provata: provate.has(r.id), mia: r.user_id === user?.id })))
      const { data: ings } = await supabase.from('ingredients').select('recipe_id, nome, nome_generico')
      if (ings) {
        const map = {}
        ings.forEach(i => { if (!map[i.recipe_id]) map[i.recipe_id] = []; map[i.recipe_id].push({ nome: i.nome, nome_generico: i.nome_generico }) })
        setIngredientiMap(map)
        // Lista ingredienti "generici" per il filtro (stessa logica della Home)
        const generici = [...new Set(ings.map(i => i.nome_generico || nomeGenerico(i.nome)).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'it'))
        setTuttiIngredienti(generici)
      }
      setLoading(false)
    }
    load()
  }, [])

  const nFiltri     = Object.values(filtriApplicati).flat().length
  const nFiltriTemp = Object.values(filtriTemp).flat().length

  const apri    = () => { setFiltriTemp(JSON.parse(JSON.stringify(filtriApplicati))); setShowFiltri(true) }
  const applica = () => { setFiltriApplicati(JSON.parse(JSON.stringify(filtriTemp))); setShowFiltri(false) }
  const azzera  = () => setFiltriTemp({})

  const filtrate = applicaFiltri(ricette, search, filtriApplicati, ingredientiMap, ambito)

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Overlay filtri */}
      {showFiltri && (
        <div style={{ position:'fixed', inset:0, background:'#FDFAF6', zIndex:200, display:'flex', flexDirection:'column' }}>
          {/* Header filtri */}
          <div style={{ background:'#1C1C1E', padding:'52px 18px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <button onClick={() => setShowFiltri(false)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <span style={{ fontSize:18, fontWeight:'bold', color:'#fff' }}>Filtri di ricerca</span>
          </div>

          {/* Corpo filtri */}
          <div style={{ flex:1, overflowY:'auto', padding:'0 18px 16px' }}>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Categoria</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {CATEGORIE_FILTRO.map(c => (
                <button key={c} style={pill((filtriTemp.categorie||[]).includes(c))}
                  onClick={() => setFiltriTemp(prev => tog(prev,'categorie',c))}>{c}</button>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Tempo</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {TEMPI_FILTRO.map(t => (
                <button key={t} style={pill((filtriTemp.tempi||[]).includes(t))}
                  onClick={() => setFiltriTemp(prev => tog(prev,'tempi',t))}>{t}</button>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Difficoltà</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {DIFFICOLTA_FILTRO.map(d => (
                <button key={d} style={pill((filtriTemp.difficolta||[]).includes(d))}
                  onClick={() => setFiltriTemp(prev => tog(prev,'difficolta',d))}>{d}</button>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Dieta</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {DIETE_FILTRO.map(d => (
                <button key={d} style={pill((filtriTemp.diete||[]).includes(d))}
                  onClick={() => setFiltriTemp(prev => tog(prev,'diete',d))}>{d}</button>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Ingrediente</div>
            <div style={{ background:'#EEEAE3', borderRadius:12, display:'flex', alignItems:'center', padding:'8px 12px', gap:8, marginBottom:8 }}>
              <span style={{ color:'#A8A8A0' }}>🔍</span>
              <input value={ingSearch} onChange={e => setIngSearch(e.target.value)}
                placeholder="Cerca ingrediente..."
                style={{ background:'transparent', border:'none', outline:'none', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', flex:1 }} />
              {ingSearch && <span onClick={() => setIngSearch('')} style={{ color:'#A8A8A0', cursor:'pointer' }}>✕</span>}
            </div>
            {(filtriTemp.ingredienti||[]).length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {filtriTemp.ingredienti.map(i => (
                  <span key={i} onClick={() => setFiltriTemp(prev => tog(prev,'ingredienti',i))} style={{ background:'#1C1C1E', color:'#fff', borderRadius:20, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', display:'flex', alignItems:'center', gap:5 }}>
                    {i} <span style={{ opacity:0.7 }}>✕</span>
                  </span>
                ))}
              </div>
            )}
            <div style={{ maxHeight:160, overflowY:'auto', border:'1px solid #F0EBE3', borderRadius:12 }}>
              {tuttiIngredienti.filter(i => i.toLowerCase().includes(ingSearch.toLowerCase())).length === 0 && (
                <div style={{ padding:'12px', fontSize:12, color:'#A8A8A0', textAlign:'center' }}>Nessun ingrediente trovato</div>
              )}
              {tuttiIngredienti.filter(i => i.toLowerCase().includes(ingSearch.toLowerCase())).map(nome => (
                <div key={nome} onClick={() => setFiltriTemp(prev => tog(prev,'ingredienti',nome))} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderBottom:'1px solid #F0EBE3', cursor:'pointer' }}>
                  <span style={{ fontSize:13, color:'#1C1C1E' }}>{nome}</span>
                  {(filtriTemp.ingredienti||[]).includes(nome) && <span style={{ color:'#1C1C1E', fontSize:15 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Bottoni */}
          <div style={{ padding:'12px 18px 32px', display:'flex', gap:10, borderTop:'1px solid #E8E3DC', flexShrink:0 }}>
            <button onClick={azzera} style={{ flex:1, background:'#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E' }}>
              Azzera
            </button>
            <button onClick={applica} style={{ flex:2, background:'#1C1C1E', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6', fontWeight:'bold' }}>
              Applica{nFiltriTemp > 0 ? ` (${nFiltriTemp})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 18px 16px', color:'#FDFAF6', flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:'bold', marginBottom:12 }}>Archivio</div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, background:'#2C2C2E', borderRadius:12, display:'flex', alignItems:'center', padding:'8px 14px', gap:8 }}>
            <span style={{ color:'#A8A8A0' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..."
              style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:13, flex:1, fontFamily:'Georgia,serif' }} />
            {search && <span onClick={() => setSearch('')} style={{ color:'#A8A8A0', cursor:'pointer', fontSize:16 }}>✕</span>}
          </div>
          <button onClick={apri} style={{ background: nFiltri > 0 ? '#F4A261' : '#2C2C2E', border:'none', borderRadius:12, padding:'8px 14px', color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', whiteSpace:'nowrap' }}>
            ⚙ Filtri{nFiltri > 0 ? ` (${nFiltri})` : ''}
          </button>
        </div>
        {/* Ambito: tutte / le mie / base */}
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          {[['tutte', 'Tutte'], ['mie', 'Le mie'], ['base', 'Base']].map(([k, label]) => (
            <button key={k} onClick={() => setAmbito(k)} style={{
              background: ambito === k ? '#F4A261' : '#2C2C2E', color: '#fff', border:'none', borderRadius:20,
              padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight: ambito === k ? 'bold' : 'normal',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 90px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#A8A8A0' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🍳</div>
            <div style={{ fontSize:13 }}>Caricamento...</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, color:'#A8A8A0', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>
              {filtrate.length} {filtrate.length === 1 ? 'ricetta' : 'ricette'}
            </div>

            {filtrate.length === 0 && (
              <div style={{ textAlign:'center', color:'#AAA', marginTop:40 }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:14 }}>Nessuna ricetta trovata</div>
                {ambito === 'mie' && <div style={{ fontFamily:'Georgia,serif', fontSize:12, marginTop:6 }}>Le ricette che aggiungi tu sono personali: tocca + per scriverne una.</div>}
              </div>
            )}

            {filtrate.map(r => (
              <div key={r.id} onClick={() => navigate(`/ricetta/${r.id}`)}
                style={{ display:'flex', gap:0, marginBottom:12, background:'#fff', borderRadius:16, overflow:'hidden', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}
                onTouchStart={e => e.currentTarget.style.opacity='0.8'}
                onTouchEnd={e => e.currentTarget.style.opacity='1'}
              >
                {/* Foto o colore */}
                {r.foto_url ? (
                  <img src={r.foto_url} alt={r.titolo} style={{ width:80, flexShrink:0, objectFit:'cover' }} />
                ) : (
                  <div style={{ background: CAT_COLORS[r.categoria] || '#F4A261', width:80, flexShrink:0 }} />
                )}
                <div style={{ padding:'12px', flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:'#A8A8A0', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>{r.categoria}{r.is_pubblica ? ' · Base' : ''}</div>
                  <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E', marginBottom:6, display:'flex', alignItems:'flex-start', gap:6 }}>
                    <span style={{ flex:1, lineHeight:1.4 }}>{r.titolo}</span>
                    {r.gia_provata && <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>👍</span>}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {r.tempo_minuti && <span style={{ fontSize:11, color:'#888' }}>⏱ {r.tempo_minuti} min</span>}
                    {r.difficolta   && <span style={{ fontSize:11, color:'#888' }}>· {r.difficolta}</span>}
                  </div>
                  {(r.diete||[]).length > 0 && (
                    <div style={{ display:'flex', gap:4, marginTop:5, flexWrap:'wrap' }}>
                      {r.diete.map(d => (
                        <span key={d} style={{ background:'#EEEAE3', borderRadius:10, padding:'2px 8px', fontSize:10, color:'#888' }}>{d}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', paddingRight:14, color:'#CCC', fontSize:18 }}>›</div>
              </div>
            ))}
          </>
        )}
      </div>

      <BottomNav active="archivio" />
    </div>
  )
}
