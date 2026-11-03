import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav.jsx'

const PRICE_LABELS = {
  claude: 'Claude Haiku (estrazione)',
  vision: 'Google Vision (OCR, storico)',
}

export default function CostiApi() {
  const [costi,   setCosti]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('api_costs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setCosti(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totale     = costi.reduce((s, r) => s + (r.costo_usd || 0), 0)
  const totClaude  = costi.filter(r => r.tipo === 'claude').reduce((s, r) => s + (r.costo_usd || 0), 0)
  const totVision  = costi.filter(r => r.tipo === 'vision').reduce((s, r) => s + (r.costo_usd || 0), 0)
  const nChiamate  = costi.filter(r => r.tipo === 'claude').length

  const fmt = (v) => v < 0.001 ? '< $0.001' : '$' + v.toFixed(4)
  const fmtData = (iso) => new Date(iso).toLocaleDateString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 20px 20px', color:'#FDFAF6', flexShrink:0 }}>
        <div style={{ fontSize:11, letterSpacing:3, color:'#A8A8A0', textTransform:'uppercase', marginBottom:4 }}>Utilizzo</div>
        <div style={{ fontSize:22, fontWeight:'bold', marginBottom:8 }}>Costi API</div>
        <div style={{ fontSize:11, color:'#A8A8A0', lineHeight:1.5, marginBottom:14 }}>
          Storico dei costi pagati con la chiave dell'app. Le importazioni con la tua chiave personale non compaiono qui: le trovi nella tua console Anthropic.
        </div>

        {/* Card totale */}
        <div style={{ background:'#2C2C2E', borderRadius:16, padding:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:4 }}>Totale speso</div>
              <div style={{ fontSize:28, fontWeight:'bold', color:'#F4A261' }}>{fmt(totale)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:4 }}>Chiamate AI</div>
              <div style={{ fontSize:28, fontWeight:'bold', color:'#FDFAF6' }}>{nChiamate}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ fontSize:10, color:'#A8A8A0', marginBottom:3 }}>Claude Haiku</div>
              <div style={{ fontSize:14, fontWeight:'bold', color:'#FDFAF6' }}>{fmt(totClaude)}</div>
            </div>
            {totVision > 0 && (
              <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:10, color:'#A8A8A0', marginBottom:3 }}>Google Vision (storico)</div>
                <div style={{ fontSize:14, fontWeight:'bold', color:'#FDFAF6' }}>{fmt(totVision)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista chiamate */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 100px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#A8A8A0' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚡</div>
            <div style={{ fontSize:13 }}>Caricamento...</div>
          </div>
        ) : costi.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#A8A8A0' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>⚡</div>
            <div style={{ fontSize:14 }}>Nessuna chiamata API ancora</div>
            <div style={{ fontSize:12, marginTop:6 }}>I costi appariranno dopo la prima importazione</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:12 }}>
              {costi.length} chiamate
            </div>
            {costi.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #F0EBE3' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:'bold', color:'#1C1C1E' }}>{PRICE_LABELS[r.tipo] || r.tipo}</div>
                  <div style={{ fontSize:11, color:'#A8A8A0', marginTop:2 }}>
                    {fmtData(r.created_at)}
                    {r.tipo === 'claude' && r.tokens_input > 0 && ` · ${r.tokens_input}↑ ${r.tokens_output}↓ tok`}
                  </div>
                </div>
                <div style={{ fontSize:13, fontWeight:'bold', color:'#F4A261' }}>{fmt(r.costo_usd)}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <BottomNav active="costi" />
    </div>
  )
}
