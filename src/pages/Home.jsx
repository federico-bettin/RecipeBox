import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { nomeGenerico } from '../lib/ingredienti'
import BottomNav from '../components/BottomNav.jsx'

const CATEGORIE = [
  { id: 'Antipasti', label: 'Antipasti', emoji: '🫒' },
  { id: 'Primi',     label: 'Primi',     emoji: '🍝' },
  { id: 'Secondi',   label: 'Secondi',   emoji: '🍖' },
  { id: 'Contorni',  label: 'Contorni',  emoji: '🥗' },
  { id: 'Dessert',   label: 'Dessert',   emoji: '🍮' },
  { id: 'Cocktail',  label: 'Cocktail',  emoji: '🍹' },
]

const DIETE_FILTRO      = ['Vegano','Vegetariano','Senza glutine','Senza lattosio']
const TEMPI_FILTRO      = ['< 15 min','< 30 min','< 60 min','Oltre 60 min']
const DIFFICOLTA_FILTRO = ['Facile','Media','Difficile']

const ora = new Date().getHours()
const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'

const pill = (active) => ({
  background: active ? '#1C1C1E' : '#EEEAE3',
  color: active ? '#fff' : '#1C1C1E',
  border: 'none', borderRadius: 20, padding: '7px 14px',
  fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia,serif',
  fontWeight: active ? 'bold' : 'normal', whiteSpace: 'nowrap',
})

const filtriVuoti = { categorie:[], diete:[], tempi:[], difficolta:[] }

export default function Home() {
  const navigate = useNavigate()
  const [profile,           setProfile]           = useState(null)
  const [tuttiIngredienti,  setTuttiIngredienti]  = useState([])
  const [showIngFiltro,     setShowIngFiltro]      = useState(false)
  const [showFiltri,        setShowFiltri]         = useState(false)
  const [ingSelezionati,    setIngSelezionati]     = useState([])
  const [ingSearch,         setIngSearch]          = useState('')
  const [filtri,            setFiltri]             = useState(filtriVuoti)
  const [filtriTemp,        setFiltriTemp]         = useState(filtriVuoti)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      // Carica tutti gli ingredienti distinti dalle ricette salvate, ridotti al nome
      // "generico" (es. "Caffè caldo molto ristretto" -> "Caffè", "Albumi" -> "Uova")
      const { data: ings } = await supabase.from('ingredients').select('nome, nome_generico')
      if (ings) {
        const generici = [...new Set(ings.map(i => i.nome_generico || nomeGenerico(i.nome)).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'it'))
        setTuttiIngredienti(generici)
      }
    }
    init()
  }, [])

  const nomeUtente = profile?.nome || ''

  const toggleIng = (nome) => {
    setIngSelezionati(prev =>
      prev.includes(nome) ? prev.filter(x => x !== nome) : [...prev, nome]
    )
  }

  const togFiltro = (key, val) => {
    setFiltriTemp(prev => ({
      ...prev,
      [key]: prev[key].includes(val) ? prev[key].filter(x => x !== val) : [...prev[key], val]
    }))
  }

  const vaiArchivio = (params = {}) => {
    const p = new URLSearchParams()
    const categorie = params.categoria ? [params.categoria] : filtri.categorie
    if (categorie.length)         p.set('categoria', categorie.join(','))
    if (ingSelezionati.length)    p.set('ingredienti', ingSelezionati.join(','))
    if (filtri.diete.length)      p.set('diete', filtri.diete.join(','))
    if (filtri.tempi.length)      p.set('tempi', filtri.tempi.join(','))
    if (filtri.difficolta.length) p.set('difficolta', filtri.difficolta.join(','))
    navigate(`/archivio?${p.toString()}`)
  }

  const applicaFiltri = () => {
    setFiltri({ ...filtriTemp })
    setShowFiltri(false)
    const p = new URLSearchParams()
    if (filtriTemp.categorie.length)   p.set('categoria', filtriTemp.categorie.join(','))
    if (ingSelezionati.length)         p.set('ingredienti', ingSelezionati.join(','))
    if (filtriTemp.diete.length)       p.set('diete', filtriTemp.diete.join(','))
    if (filtriTemp.tempi.length)       p.set('tempi', filtriTemp.tempi.join(','))
    if (filtriTemp.difficolta.length)  p.set('difficolta', filtriTemp.difficolta.join(','))
    navigate(`/archivio?${p.toString()}`)
  }

  const azzeraFiltri = () => {
    setFiltriTemp(filtriVuoti)
    setIngSelezionati([])
    setIngSearch('')
  }

  const nFiltri     = filtri.categorie.length + filtri.diete.length + filtri.tempi.length + filtri.difficolta.length
  const nFiltriTemp = filtriTemp.categorie.length + filtriTemp.diete.length + filtriTemp.tempi.length + filtriTemp.difficolta.length
  const ingFiltrati = tuttiIngredienti.filter(i => i.toLowerCase().includes(ingSearch.toLowerCase()))

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Overlay: filtro rapido per ingrediente (standalone) */}
      {showIngFiltro && (
        <div style={{ position:'fixed', inset:0, background:'#FDFAF6', zIndex:200, display:'flex', flexDirection:'column' }}>
          <div style={{ background:'#1C1C1E', padding:'52px 18px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <button onClick={() => setShowIngFiltro(false)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <span style={{ fontSize:18, fontWeight:'bold', color:'#fff' }}>Filtra per ingrediente</span>
          </div>
          <div style={{ padding:'14px 18px 8px', flexShrink:0 }}>
            <div style={{ background:'#EEEAE3', borderRadius:12, display:'flex', alignItems:'center', padding:'8px 12px', gap:8 }}>
              <span style={{ color:'#A8A8A0' }}>🔍</span>
              <input value={ingSearch} onChange={e => setIngSearch(e.target.value)}
                placeholder="Cerca ingrediente..."
                style={{ background:'transparent', border:'none', outline:'none', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', flex:1 }} />
              {ingSearch && <span onClick={() => setIngSearch('')} style={{ color:'#A8A8A0', cursor:'pointer' }}>✕</span>}
            </div>
            {ingSelezionati.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                {ingSelezionati.map(i => (
                  <span key={i} onClick={() => toggleIng(i)} style={{ background:'#1C1C1E', color:'#fff', borderRadius:20, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', display:'flex', alignItems:'center', gap:5 }}>
                    {i} <span style={{ opacity:0.7 }}>✕</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'0 18px 16px' }}>
            {ingFiltrati.map(nome => (
              <div key={nome} onClick={() => toggleIng(nome)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #F0EBE3', cursor:'pointer' }}>
                <span style={{ fontSize:14, color:'#1C1C1E' }}>{nome}</span>
                {ingSelezionati.includes(nome) && <span style={{ color:'#1C1C1E', fontSize:16 }}>✓</span>}
              </div>
            ))}
          </div>
          <div style={{ padding:'12px 18px 32px', borderTop:'1px solid #E8E3DC', flexShrink:0 }}>
            <button onClick={() => { setShowIngFiltro(false); vaiArchivio() }}
              style={{ width:'100%', background:'#1C1C1E', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6', fontWeight:'bold' }}>
              {ingSelezionati.length > 0 ? `Cerca ricette con ${ingSelezionati.length} ingrediente${ingSelezionati.length>1?'i':''}` : 'Vai all\'archivio'}
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Filtri completi (categoria, dieta, difficoltà, ingrediente, tempo) */}
      {showFiltri && (
        <div style={{ position:'fixed', inset:0, background:'#FDFAF6', zIndex:200, display:'flex', flexDirection:'column' }}>
          <div style={{ background:'#1C1C1E', padding:'52px 18px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <button onClick={() => setShowFiltri(false)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <span style={{ fontSize:18, fontWeight:'bold', color:'#fff' }}>Filtri</span>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'0 18px 16px' }}>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Categoria</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {CATEGORIE.map(c => (
                <button key={c.id} style={pill(filtriTemp.categorie.includes(c.id))}
                  onClick={() => togFiltro('categorie', c.id)}>{c.emoji} {c.label}</button>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Dieta</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {DIETE_FILTRO.map(d => (
                <button key={d} style={pill(filtriTemp.diete.includes(d))}
                  onClick={() => togFiltro('diete', d)}>{d}</button>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Difficoltà</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {DIFFICOLTA_FILTRO.map(d => (
                <button key={d} style={pill(filtriTemp.difficolta.includes(d))}
                  onClick={() => togFiltro('difficolta', d)}>{d}</button>
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
            {ingSelezionati.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {ingSelezionati.map(i => (
                  <span key={i} onClick={() => toggleIng(i)} style={{ background:'#1C1C1E', color:'#fff', borderRadius:20, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', display:'flex', alignItems:'center', gap:5 }}>
                    {i} <span style={{ opacity:0.7 }}>✕</span>
                  </span>
                ))}
              </div>
            )}
            <div style={{ maxHeight:160, overflowY:'auto', border:'1px solid #F0EBE3', borderRadius:12 }}>
              {ingFiltrati.length === 0 && (
                <div style={{ padding:'12px', fontSize:12, color:'#A8A8A0', textAlign:'center' }}>Nessun ingrediente trovato</div>
              )}
              {ingFiltrati.map(nome => (
                <div key={nome} onClick={() => toggleIng(nome)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderBottom:'1px solid #F0EBE3', cursor:'pointer' }}>
                  <span style={{ fontSize:13, color:'#1C1C1E' }}>{nome}</span>
                  {ingSelezionati.includes(nome) && <span style={{ color:'#1C1C1E', fontSize:15 }}>✓</span>}
                </div>
              ))}
            </div>

            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, marginTop:18 }}>Tempo</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {TEMPI_FILTRO.map(t => (
                <button key={t} style={pill(filtriTemp.tempi.includes(t))}
                  onClick={() => togFiltro('tempi', t)}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ padding:'12px 18px 32px', display:'flex', gap:10, borderTop:'1px solid #E8E3DC', flexShrink:0 }}>
            <button onClick={azzeraFiltri} style={{ flex:1, background:'#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E' }}>Azzera</button>
            <button onClick={applicaFiltri} style={{ flex:2, background:'#1C1C1E', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6', fontWeight:'bold' }}>
              Applica{nFiltriTemp > 0 ? ` (${nFiltriTemp})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 24px 20px', color:'#FDFAF6', flexShrink:0 }}>
        <div style={{ fontSize:11, letterSpacing:3, color:'#A8A8A0', textTransform:'uppercase', marginBottom:4 }}>
          {saluto}{nomeUtente ? `, ${nomeUtente}` : ''}
        </div>
        <div style={{ fontSize:22, fontWeight:'bold', letterSpacing:-0.5 }}>Cosa cuciniamo oggi?</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 100px', display:'flex', flexDirection:'column' }}>

        {/* Filtri — largo quanto "Tutte le ricette", in cima */}
        <button onClick={() => { setFiltriTemp({ ...filtri }); setShowFiltri(true) }}
          style={{ width:'100%', background: nFiltri > 0 ? '#F4A261' : '#EEEAE3', color: nFiltri > 0 ? '#fff' : '#1C1C1E', border:'none', borderRadius:16, padding:'11px 14px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:14 }}>
          ⚙ Filtri{nFiltri > 0 ? ` (${nFiltri})` : ''}
        </button>

        {/* Categorie */}
        <div style={{ fontSize:11, letterSpacing:3, color:'#A8A8A0', textTransform:'uppercase', marginBottom:12 }}>Categorie</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {CATEGORIE.map(cat => (
            <button key={cat.id} onClick={() => vaiArchivio({ categoria: cat.id })}
              style={{ background:'#EEEAE3', color:'#1C1C1E', border:'none', borderRadius:20, padding:'22px 14px', fontSize:14, fontFamily:'Georgia,serif', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, fontWeight:'bold', textTransform:'uppercase', letterSpacing:1, width:'100%', transition:'all 0.2s', minHeight:100 }}
              onTouchStart={e => { e.currentTarget.style.background='#1C1C1E'; e.currentTarget.style.color='#fff' }}
              onTouchEnd={e => { e.currentTarget.style.background='#EEEAE3'; e.currentTarget.style.color='#1C1C1E' }}>
              <span style={{ fontSize:32 }}>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Per ingrediente — stile "Tutte le ricette", colore accento arancione */}
        <button onClick={() => setShowIngFiltro(true)}
          style={{
            width:'100%', marginTop:14,
            background: ingSelezionati.length > 0 ? '#F4A261' : 'transparent',
            border: ingSelezionati.length > 0 ? 'none' : '2px solid #F4A261',
            borderRadius:20, padding:'11px', fontSize:13, fontFamily:'Georgia,serif',
            color: ingSelezionati.length > 0 ? '#fff' : '#F4A261', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontWeight:'bold',
          }}>
          <span style={{ fontSize:16 }}>🥕</span>
          {ingSelezionati.length > 0 ? `${ingSelezionati.length} ingrediente${ingSelezionati.length>1?'i':''} selezionat${ingSelezionati.length>1?'i':'o'}` : 'Per ingrediente'}
        </button>

        {/* Tutte le ricette */}
        <button onClick={() => vaiArchivio()}
          style={{ width:'100%', marginTop:10, background:'transparent', border:'2px solid #EEEAE3', borderRadius:20, padding:'16px', fontSize:13, fontFamily:'Georgia,serif', color:'#A8A8A0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>≡</span> Tutte le ricette
        </button>
      </div>

      <BottomNav active="home" />
    </div>
  )
}
