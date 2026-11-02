import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CAT_COLORS = {
  Antipasti: '#2A9D8F', Primi: '#F4A261', Secondi: '#264653',
  Contorni: '#E9C46A', Dessert: '#E76F51', Cocktail: '#457B9D',
}

const GIORNI_CESTINO = 7

function giorniRimanenti(eliminataIl) {
  const scadenza = new Date(eliminataIl)
  scadenza.setDate(scadenza.getDate() + GIORNI_CESTINO)
  const diffMs = scadenza - new Date()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export default function Cestino() {
  const navigate = useNavigate()
  const [ricette, setRicette] = useState([])
  const [loading, setLoading] = useState(true)

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .not('eliminata_il', 'is', null)
      .order('eliminata_il', { ascending: false })
    setRicette(data || [])
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  const ripristina = async (id) => {
    await supabase.from('recipes').update({ eliminata_il: null }).eq('id', id)
    setRicette(prev => prev.filter(r => r.id !== id))
  }

  const eliminaDefinitivamente = async (r) => {
    if (r.foto_url) {
      const path = r.foto_url.split('/recipe-photos/')[1]
      if (path) await supabase.storage.from('recipe-photos').remove([path])
    }
    await supabase.from('recipes').delete().eq('id', r.id)
    setRicette(prev => prev.filter(x => x.id !== r.id))
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 18px 16px', color:'#FDFAF6', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <button onClick={() => navigate(-1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:34, height:34, color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>‹</button>
        <div>
          <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase' }}>Ricette eliminate</div>
          <div style={{ fontSize:18, fontWeight:'bold' }}>Cestino</div>
        </div>
      </div>

      {/* Corpo */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 40px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#A8A8A0' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🍳</div>
            <div style={{ fontSize:13 }}>Caricamento...</div>
          </div>
        ) : ricette.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#A8A8A0' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🗑</div>
            <div style={{ fontSize:14 }}>Il cestino è vuoto</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, color:'#A8A8A0', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>
              {ricette.length} {ricette.length === 1 ? 'ricetta' : 'ricette'} · eliminazione automatica dopo {GIORNI_CESTINO} giorni
            </div>
            {ricette.map(r => {
              const giorni = giorniRimanenti(r.eliminata_il)
              return (
                <div key={r.id} style={{ display:'flex', gap:0, marginBottom:12, background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                  {r.foto_url ? (
                    <img src={r.foto_url} alt={r.titolo} style={{ width:70, flexShrink:0, objectFit:'cover', opacity:0.6 }} />
                  ) : (
                    <div style={{ background: CAT_COLORS[r.categoria] || '#F4A261', width:70, flexShrink:0, opacity:0.5 }} />
                  )}
                  <div style={{ padding:'12px', flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:'#A8A8A0', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>{r.categoria}</div>
                    <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E', marginBottom:6 }}>{r.titolo}</div>
                    <div style={{ fontSize:11, color: giorni <= 1 ? '#E76F51' : '#888', marginBottom:8 }}>
                      {giorni === 0 ? 'Verrà eliminata a breve' : `Eliminazione definitiva tra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => ripristina(r.id)} style={{ background:'#1C1C1E', color:'#fff', border:'none', borderRadius:10, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:'bold' }}>
                        ↺ Ripristina
                      </button>
                      <button onClick={() => eliminaDefinitivamente(r)} style={{ background:'#FFF0F0', color:'#E76F51', border:'1px solid #FDD', borderRadius:10, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif' }}>
                        Elimina ora
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
