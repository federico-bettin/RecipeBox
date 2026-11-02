import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formattaUnita } from '../lib/ingredienti'

const GIORNI      = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"]
const GIORNI_FULL = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"]
const PASTI       = ["Colazione","Pranzo","Cena"]
const PASTO_EMOJI = { Colazione:"☀️", Pranzo:"🌤", Cena:"🌙" }
const N_SLOT      = GIORNI.length * PASTI.length // 21

const CAT_COLORS = {
  Antipasti:'#2A9D8F', Primi:'#F4A261', Secondi:'#264653',
  Contorni:'#E9C46A', Dessert:'#E76F51', Cocktail:'#457B9D',
}

// Lunedì della settimana corrente
const getLunedi = (offset = 0) => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - (day === 0 ? 6 : day - 1) + offset * 7
  d.setDate(diff); d.setHours(0,0,0,0)
  return d
}

const fmtData = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

const getRangeLabel = (lunedi) => {
  const dom = new Date(lunedi); dom.setDate(dom.getDate() + 6)
  const mesi = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  return `${lunedi.getDate()} – ${dom.getDate()} ${mesi[dom.getMonth()]} ${dom.getFullYear()}`
}

// ─── DRAWER MODIFICA SLOT ─────────────────────────────────────────────────────
function DrawerModifica({ giornoLabel, pasto, ricetteArchivio, onSelect, onRemove, onClose, haRicetta }) {
  const [search, setSearch] = useState('')

  // Ordina i suggerimenti per pertinenza al pasto: colazione->dessert prima,
  // pranzo->primi prima, cena->secondi/contorni prima. Antipasti e cocktail
  // vanno sempre in fondo, indipendentemente dal pasto.
  const prioritaCategoria = (categoria) => {
    if (categoria === 'Antipasti' || categoria === 'Cocktail') return 3
    if (pasto === 'Colazione') return categoria === 'Dessert' ? 1 : 2
    if (pasto === 'Pranzo')    return categoria === 'Primi' ? 1 : 2
    if (pasto === 'Cena')      return (categoria === 'Secondi' || categoria === 'Contorni') ? 1 : 2
    return 2
  }

  const filtered = ricetteArchivio
    .filter(r => r.titolo.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => prioritaCategoria(a.categoria) - prioritaCategoria(b.categoria))
  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', flexDirection:'column' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.45)', cursor:'pointer' }} />
      <div style={{ background:'#FDFAF6', borderRadius:'24px 24px 0 0', maxHeight:'72%', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 0' }}>
          <div style={{ width:36, height:4, background:'#DDDAD5', borderRadius:2 }} />
        </div>
        <div style={{ padding:'10px 18px 12px', borderBottom:'1px solid #EEE9E2' }}>
          <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:2, fontFamily:'Georgia,serif' }}>{giornoLabel} · {pasto}</div>
          <div style={{ fontSize:16, fontWeight:'bold', color:'#1C1C1E', fontFamily:'Georgia,serif' }}>Cambia ricetta</div>
        </div>
        <div style={{ padding:'10px 18px 8px' }}>
          <div style={{ background:'#EEEAE3', borderRadius:12, display:'flex', alignItems:'center', padding:'8px 12px', gap:8 }}>
            <span style={{ color:'#A8A8A0', fontSize:14 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca ricetta..." autoFocus
              style={{ background:'transparent', border:'none', outline:'none', fontSize:13, fontFamily:'Georgia,serif', color:'#1C1C1E', flex:1 }} />
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'0 18px 16px' }}>
          {haRicetta && (
            <div onClick={onRemove} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, marginBottom:6, background:'#FFF0F0', cursor:'pointer', border:'1px solid #FDD' }}>
              <span style={{ fontSize:16 }}>🗑</span>
              <span style={{ fontSize:13, color:'#E76F51', fontFamily:'Georgia,serif' }}>Rimuovi ricetta</span>
            </div>
          )}
          {filtered.length === 0 && <div style={{ color:'#A8A8A0', fontSize:13, textAlign:'center', padding:'20px 0', fontFamily:'Georgia,serif' }}>Nessuna ricetta trovata</div>}
          {filtered.map(r => (
            <div key={r.id} onClick={() => onSelect(r.id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #F0EBE3', cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity='0.7'}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}>
              <div style={{ width:8, height:36, borderRadius:4, background: CAT_COLORS[r.categoria]||'#F4A261', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:'bold', color:'#1C1C1E', fontFamily:'Georgia,serif' }}>{r.titolo}</div>
                <div style={{ fontSize:11, color:'#A8A8A0', marginTop:1, fontFamily:'Georgia,serif' }}>{r.categoria}{r.tempo_minuti ? ` · ⏱ ${r.tempo_minuti} min` : ''}</div>
              </div>
              <span style={{ color:'#CCC', fontSize:18 }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MODALE SELEZIONE SPESA ───────────────────────────────────────────────────
function ModaleSelezioneSpesa({ piano, ricetteMap, onConferma, onClose }) {
  const [modo, setModo]         = useState('settimana')
  const [selGiorni, setSelGiorni] = useState(new Set())
  const [selPasti, setSelPasti]   = useState({})

  const calcolaChiavi = () => {
    if (modo === 'settimana') return Object.keys(piano)
    if (modo === 'giorni') return [...selGiorni].flatMap(g => PASTI.map(p => `${g}-${p}`)).filter(k => piano[k])
    return Object.entries(selPasti).flatMap(([g,ps]) => [...ps].map(p => `${g}-${p}`)).filter(k => piano[k])
  }

  const chiavi   = calcolaChiavi()
  const nPiatti  = chiavi.length

  const toggleGiorno = g => setSelGiorni(prev => { const n = new Set(prev); n.has(g)?n.delete(g):n.add(g); return n })
  const togglePasto  = (g,p) => setSelPasti(prev => { const cur = new Set(prev[g]||[]); cur.has(p)?cur.delete(p):cur.add(p); return {...prev,[g]:cur} })

  const pillOn  = { background:'#1C1C1E', color:'#fff', border:'none', borderRadius:20, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:'bold' }
  const pillOff = { background:'#EEEAE3', color:'#1C1C1E', border:'none', borderRadius:20, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:550, display:'flex', flexDirection:'column' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.45)', cursor:'pointer' }} />
      <div style={{ background:'#FDFAF6', borderRadius:'24px 24px 0 0', maxHeight:'80%', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 0' }}>
          <div style={{ width:36, height:4, background:'#DDDAD5', borderRadius:2 }} />
        </div>
        <div style={{ padding:'10px 18px 14px', borderBottom:'1px solid #EEE9E2' }}>
          <div style={{ fontSize:16, fontWeight:'bold', color:'#1C1C1E', fontFamily:'Georgia,serif' }}>🛒 Crea lista della spesa</div>
          <div style={{ fontSize:12, color:'#A8A8A0', marginTop:3, fontFamily:'Georgia,serif' }}>Scegli per quali pasti generare la lista</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
          {/* Toggle modo */}
          <div style={{ display:'flex', background:'#EEEAE3', borderRadius:12, padding:3, marginBottom:16 }}>
            {[['settimana','Tutta la settimana'],['giorni','Per giorno'],['pasti','Singoli pasti']].map(([k,label]) => (
              <button key={k} onClick={() => setModo(k)} style={{
                flex:1, background: modo===k?'#1C1C1E':'transparent',
                color: modo===k?'#fff':'#888', border:'none', borderRadius:10,
                padding:'7px 4px', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif',
                fontWeight: modo===k?'bold':'normal', transition:'all 0.2s',
              }}>{label}</button>
            ))}
          </div>

          {modo === 'settimana' && (
            <div style={{ background:'#FFF8F2', borderRadius:14, padding:'14px 16px', border:'1px solid #F4E0CC', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
              <div style={{ fontSize:14, color:'#1C1C1E', fontFamily:'Georgia,serif', fontWeight:'bold', marginBottom:4 }}>Tutti i pasti della settimana</div>
              <div style={{ fontSize:12, color:'#A8A8A0' }}>{Object.keys(piano).length} ricette pianificate</div>
            </div>
          )}

          {modo === 'giorni' && (
            <div>
              <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:10 }}>Seleziona i giorni</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {GIORNI.map((g,gi) => {
                  const haPasti = PASTI.some(p => piano[`${g}-${p}`])
                  if (!haPasti) return null
                  const on = selGiorni.has(g)
                  return <button key={g} onClick={() => toggleGiorno(g)} style={on?pillOn:pillOff}>{GIORNI_FULL[gi]}</button>
                })}
              </div>
              {selGiorni.size > 0 && <div style={{ fontSize:12, color:'#A8A8A0', marginTop:10, fontFamily:'Georgia,serif' }}>{nPiatti} ricette selezionate</div>}
            </div>
          )}

          {modo === 'pasti' && (
            <div>
              <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:10 }}>Seleziona i pasti</div>
              {GIORNI.map((g,gi) => {
                const disponibili = PASTI.filter(p => piano[`${g}-${p}`])
                if (!disponibili.length) return null
                const curSet = selPasti[g] || new Set()
                return (
                  <div key={g} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:12, color:'#888', fontFamily:'Georgia,serif', marginBottom:6 }}>{GIORNI_FULL[gi]}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {disponibili.map(p => {
                        const on = curSet.has(p)
                        const r  = ricetteMap[piano[`${g}-${p}`]]
                        return (
                          <button key={p} onClick={() => togglePasto(g,p)} style={{ ...(on?pillOn:pillOff), display:'flex', alignItems:'center', gap:5 }}>
                            <span>{PASTO_EMOJI[p]}</span>
                            <span>{p}</span>
                            {r && <span style={{ fontSize:10, opacity:0.7 }}>· {r.titolo.slice(0,12)}{r.titolo.length>12?'…':''}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 18px 28px', borderTop:'1px solid #E8E3DC' }}>
          <button onClick={() => nPiatti>0 && onConferma(chiavi)} style={{
            width:'100%', border:'none', borderRadius:14, padding:'14px', fontSize:13,
            cursor: nPiatti>0?'pointer':'default', fontFamily:'Georgia,serif', fontWeight:'bold',
            background: nPiatti>0?'#1C1C1E':'#EEEAE3', color: nPiatti>0?'#FDFAF6':'#AAA', transition:'all 0.2s',
          }}>
            {nPiatti>0 ? `Genera lista (${nPiatti} ${nPiatti===1?'ricetta':'ricette'})` : 'Seleziona almeno un pasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PANNELLO LISTA SPESA ─────────────────────────────────────────────────────
function PannelloSpesa({ piano, ricetteMap, selezione, onClose }) {
  const ingredientiMap = {}
  selezione.forEach(key => {
    const id = piano[key]; if (!id) return
    const r = ricetteMap[id]; if (!r || !r.ingredienti) return
    r.ingredienti.forEach(ing => {
      const k = `${ing.nome}||${ing.unita}`
      if (ingredientiMap[k]) ingredientiMap[k].qty += (ing.quantita||0)
      else ingredientiMap[k] = { nome:ing.nome, qty: ing.quantita||0, unita:ing.unita||'' }
    })
  })
  const listaIniziale = Object.values(ingredientiMap).map((item,i) => ({
    ...item, id:i, spuntato:false,
    qtyStr: Number.isInteger(item.qty) ? String(item.qty) : item.qty.toFixed(1),
  }))

  const [items, setItems]   = useState(listaIniziale)
  const [editId, setEditId] = useState(null)
  const [inviato, setInviato] = useState(false)

  const toggleSpunta  = id => setItems(prev => prev.map(it => it.id===id ? {...it, spuntato:!it.spuntato} : it))
  const aggiornaQty   = (id,val) => setItems(prev => prev.map(it => it.id===id ? {...it, qtyStr:val} : it))

  const visibili = items.filter(it => !it.spuntato)
  const spuntati = items.filter(it => it.spuntato)

  const descrivi = () => {
    if (selezione.length === N_SLOT) return 'Tutta la settimana'
    const giorni = [...new Set(selezione.map(k => k.split('-')[0]))]
    if (giorni.length === 1) {
      const pasti = selezione.map(k => k.split('-')[1])
      if (pasti.length === 1) return `${GIORNI_FULL[GIORNI.indexOf(giorni[0])]} · ${pasti[0]}`
      return GIORNI_FULL[GIORNI.indexOf(giorni[0])]
    }
    return `${giorni.length} giorni selezionati`
  }

  const testoWA = () => {
    const isTutta = selezione.length === N_SLOT
    const giorni  = [...new Set(selezione.map(k => k.split('-')[0]))]
    const periodo = isTutta ? 'Tutta la settimana' : giorni.map(g => GIORNI_FULL[GIORNI.indexOf(g)]).join(', ')
    return `🛒 *Lista spesa — ${periodo}*\n\n` + visibili.map(it => `• ${it.nome}: ${it.qtyStr} ${formattaUnita(it.unita, it.qtyStr)}`).join('\n')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#FDFAF6', zIndex:600, display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>
      <div style={{ background:'#1C1C1E', padding:'52px 18px 14px', color:'#FDFAF6' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <div>
            <div style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:2 }}>{descrivi()}</div>
            <div style={{ fontSize:18, fontWeight:'bold' }}>Lista della spesa</div>
          </div>
        </div>
      </div>

      <div style={{ flex:1, padding:'0 18px', overflowY:'auto' }}>
        {items.length === 0 ? (
          <div style={{ textAlign:'center', color:'#AAA', marginTop:60 }}>
            <div style={{ fontSize:36, marginBottom:10 }}>✓</div>
            <div style={{ fontSize:14 }}>Lista completata!</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', padding:'14px 0 8px' }}>
              {visibili.length} da acquistare{spuntati.length>0 ? ` · ${spuntati.length} già in casa` : ''}
            </div>
            <div style={{ fontSize:11, color:'#C96B2A', marginBottom:10, background:'#FFF8F2', borderRadius:8, padding:'6px 10px' }}>
              Spunta per segnare come già in casa · tap sulla quantità per modificarla
            </div>

            {visibili.map(it => (
              <div key={it.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F0EBE3' }}>
                <div onClick={() => toggleSpunta(it.id)} style={{ width:22, height:22, borderRadius:'50%', border:'2px solid #CCC', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }} />
                <span style={{ flex:1, fontSize:14, color:'#1C1C1E' }}>{it.nome}</span>
                {editId === it.id ? (
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <input autoFocus value={it.qtyStr} onChange={e => aggiornaQty(it.id,e.target.value)}
                      onBlur={() => setEditId(null)} onKeyDown={e => e.key==='Enter' && setEditId(null)}
                      style={{ width:52, background:'#EEEAE3', border:'none', borderRadius:8, padding:'4px 8px', fontSize:13, fontFamily:'Georgia,serif', textAlign:'center', outline:'none', color:'#1C1C1E' }} />
                    <span style={{ fontSize:12, color:'#888' }}>{formattaUnita(it.unita, it.qtyStr)}</span>
                  </div>
                ) : (
                  <span onClick={() => setEditId(it.id)} style={{ fontSize:14, fontWeight:'bold', color:'#F4A261', cursor:'pointer', borderBottom:'1px dashed #F4A261' }}>
                    {it.qtyStr} {formattaUnita(it.unita, it.qtyStr)}
                  </span>
                )}
              </div>
            ))}

            {spuntati.length > 0 && (
              <>
                <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', padding:'16px 0 8px' }}>Già in casa</div>
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

      <div style={{ padding:'12px 18px 32px', display:'flex', flexDirection:'column', gap:10, borderTop:'1px solid #E8E3DC' }}>
        {!inviato ? (
          <button onClick={() => setInviato(true)} style={{ background:'#E8572A', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#fff', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>🛍</span> Invia a Bring!
          </button>
        ) : (
          <div style={{ background:'#E8F5E9', borderRadius:14, padding:'13px', textAlign:'center', fontSize:13, color:'#2D6A2D', fontFamily:'Georgia,serif' }}>✓ Lista inviata a Bring!</div>
        )}
        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(testoWA())}`, '_blank')}
          style={{ background:'#25D366', border:'none', borderRadius:14, padding:'12px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#fff', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>💬</span> Condividi su WhatsApp
        </button>
      </div>
    </div>
  )
}

// ─── SLOT CARD ────────────────────────────────────────────────────────────────
function SlotCard({ ricetta, pasto, compact=false, onTap, onModifica, style={} }) {
  const pressTimer = useRef(null)
  const didLong    = useRef(false)

  const handleDown = () => {
    if (!ricetta) return
    didLong.current = false
    pressTimer.current = setTimeout(() => { didLong.current = true; onModifica() }, 500)
  }
  const handleUp    = () => clearTimeout(pressTimer.current)
  const handleClick = () => { if (didLong.current) return; ricetta ? onTap() : onModifica() }

  const color = ricetta ? (CAT_COLORS[ricetta.categoria] || '#F4A261') : '#EEEAE3'

  return (
    <button onMouseDown={handleDown} onMouseUp={handleUp} onTouchStart={handleDown} onTouchEnd={handleUp} onClick={handleClick}
      style={{ background:color, border:'none', borderRadius:12, cursor:'pointer', textAlign:'left',
        padding: ricetta ? (compact?'7px 10px':'10px 12px') : (compact?'8px 10px':'12px'),
        minHeight: compact?36:60, position:'relative', transition:'opacity 0.15s', ...style }}
      onMouseEnter={e => e.currentTarget.style.opacity='0.82'}
      onMouseLeave={e => e.currentTarget.style.opacity='1'}>
      {ricetta ? (
        <>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', letterSpacing:1, textTransform:'uppercase', marginBottom:compact?2:3 }}>
            {PASTO_EMOJI[pasto]} {pasto}
          </div>
          <div style={{ fontSize:compact?11:12, fontWeight:'bold', color:'#fff', lineHeight:1.3, fontFamily:'Georgia,serif', paddingRight:24 }}>
            {ricetta.titolo}
          </div>
          {!compact && ricetta.tempo_minuti && <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:3 }}>⏱ {ricetta.tempo_minuti} min</div>}
          <div onClick={e => { e.stopPropagation(); onModifica() }}
            style={{ position:'absolute', top:6, right:6, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'rgba(255,255,255,0.8)', cursor:'pointer' }}>✎</div>
        </>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:compact?4:6 }}>
          <span style={{ fontSize:compact?13:16, color:'#C5C0B8' }}>+</span>
          <span style={{ fontSize:compact?10:11, color:'#B0AB9F', fontFamily:'Georgia,serif' }}>{PASTO_EMOJI[pasto]} {pasto}</span>
        </div>
      )}
    </button>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Piano() {
  const navigate = useNavigate()

  // Settimana
  const [settOffset, setSettOffset] = useState(0)
  const lunedi = getLunedi(settOffset)
  const rangeLabel = getRangeLabel(lunedi)
  const settKey = fmtData(lunedi) // chiave per DB

  // Dati
  const [piano,        setPiano]        = useState({}) // { "Lun-Pranzo": recipeId, ... }
  const [ricetteMap,   setRicetteMap]   = useState({}) // { id: { ...ricetta, ingredienti:[] } }
  const [planId,       setPlanId]       = useState(null)
  const [loading,      setLoading]      = useState(true)

  // Overlay states
  const [vista,        setVista]        = useState('settimana')
  const [giornoSel,    setGiornoSel]    = useState('Lun')
  const [drawerMod,    setDrawerMod]    = useState(null) // { key, giorno, pasto }
  const [modaleSpesa,  setModaleSpesa]  = useState(false)
  const [spesaChiavi,   setSpesaChiavi]   = useState(null)
  const [modaleDuplica, setModaleDuplica] = useState(false)
  const [duplicaTarget, setDuplicaTarget] = useState('')
  const [duplicando,    setDuplicando]    = useState(false)

  // Carica ricette archivio
  useEffect(() => {
    const loadRicette = async () => {
      const { data } = await supabase.from('recipes').select('*, ingredients(*)').is('eliminata_il', null)
      if (!data) return
      const map = {}
      data.forEach(r => { map[r.id] = { ...r, ingredienti: r.ingredients || [] } })
      setRicetteMap(map)
    }
    loadRicette()
  }, [])

  // Carica piano della settimana
  useEffect(() => {
    const loadPiano = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      // Cerca o crea il piano per questa settimana
      let { data: plan } = await supabase.from('weekly_plans')
        .select('*').eq('user_id', user.id).eq('settimana_inizio', settKey).single()

      if (!plan) {
        const { data: newPlan } = await supabase.from('weekly_plans')
          .insert({ user_id: user.id, settimana_inizio: settKey }).select().single()
        plan = newPlan
      }
      if (!plan) { setLoading(false); return }
      setPlanId(plan.id)

      // Carica gli slot
      const { data: slots } = await supabase.from('plan_slots')
        .select('*').eq('plan_id', plan.id)

      const pianoObj = {}
      if (slots) slots.forEach(s => { pianoObj[`${s.giorno}-${s.pasto}`] = s.recipe_id })
      setPiano(pianoObj)
      setLoading(false)
    }
    loadPiano()
  }, [settKey])

  const salvaSlot = async (giorno, pasto, recipeId) => {
    const key = `${giorno}-${pasto}`
    // Upsert slot
    await supabase.from('plan_slots').upsert(
      { plan_id: planId, giorno, pasto, recipe_id: recipeId },
      { onConflict: 'plan_id,giorno,pasto' }
    )
    setPiano(prev => ({ ...prev, [key]: recipeId }))
  }

  const rimuoviSlot = async (giorno, pasto) => {
    const key = `${giorno}-${pasto}`
    await supabase.from('plan_slots').delete()
      .eq('plan_id', planId).eq('giorno', giorno).eq('pasto', pasto)
    setPiano(prev => { const n = {...prev}; delete n[key]; return n })
  }

  const tornaOggi = () => {
    setSettOffset(0)
    const dayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
    setGiornoSel(GIORNI[dayIdx])
    setVista('giorno')
  }

  const duplicaSu = async () => {
    if (!duplicaTarget || !planId) { alert('Nessun piano da duplicare. Assicurati di avere pasti nella settimana corrente.'); return }
    setDuplicando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Legge slot dal planId in memoria
      const { data: sourceSlots, error: sErr } = await supabase
        .from('plan_slots').select('*').eq('plan_id', planId)
      if (sErr) throw new Error('Lettura pasti fallita: ' + sErr.message)
      if (!sourceSlots?.length) { alert('Nessun pasto nella settimana corrente da copiare.'); setDuplicando(false); return }

      // Trova o crea piano target
      let { data: tp, error: tpErr } = await supabase.from('weekly_plans')
        .select('id').eq('user_id', user.id).eq('settimana_inizio', duplicaTarget).maybeSingle()
      if (tpErr) throw new Error('Ricerca piano target fallita: ' + tpErr.message)
      if (!tp) {
        const { data: np, error: npErr } = await supabase.from('weekly_plans')
          .insert({ user_id: user.id, settimana_inizio: duplicaTarget }).select('id').single()
        if (npErr) throw new Error('Creazione piano target fallita: ' + npErr.message)
        tp = np
      }

      // Elimina slot esistenti nel target
      const { error: delErr } = await supabase.from('plan_slots').delete().eq('plan_id', tp.id)
      if (delErr) throw new Error('Cancellazione slot esistenti fallita: ' + delErr.message)

      // Copia gli slot
      const slots = sourceSlots.map(s => ({
        plan_id: tp.id, giorno: s.giorno, pasto: s.pasto, recipe_id: s.recipe_id
      }))
      const { error: insErr } = await supabase.from('plan_slots').insert(slots)
      if (insErr) throw new Error('Inserimento slot fallito: ' + insErr.message)

      setModaleDuplica(false)
      setDuplicaTarget('')
      alert(`✓ Copiati ${slots.length} pasti su ${duplicaTarget}`)
    } catch (e) {
      console.error('duplicaSu error:', e)
      alert('Errore: ' + e.message)
    }
    setDuplicando(false)
  }

  const nRicette  = Object.keys(piano).length
  const idxGiorno = GIORNI.indexOf(giornoSel)
  const ricetteList = Object.values(ricetteMap)

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {modaleDuplica && (
        <div style={{ position:'fixed', inset:0, zIndex:550, display:'flex', flexDirection:'column' }}>
          <div onClick={() => { setModaleDuplica(false); setDuplicaTarget('') }} style={{ flex:1, background:'rgba(0,0,0,0.45)', cursor:'pointer' }} />
          <div style={{ background:'#FDFAF6', borderRadius:'24px 24px 0 0', padding:'16px 18px 36px', boxShadow:'0 -8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
              <div style={{ width:36, height:4, background:'#DDDAD5', borderRadius:2 }} />
            </div>
            <div style={{ fontSize:16, fontWeight:'bold', color:'#1C1C1E', marginBottom:4, fontFamily:'Georgia,serif' }}>Duplica settimana</div>
            <div style={{ fontSize:12, color:'#A8A8A0', marginBottom:14, fontFamily:'Georgia,serif' }}>
              {'Copia i ' + nRicette + ' pasti di ' + rangeLabel + ' su:'}
            </div>
            <input type="date" value={duplicaTarget} onChange={e => setDuplicaTarget(e.target.value)}
              style={{ width:'100%', background:'#EEEAE3', border:'none', borderRadius:12, padding:'12px 14px', fontSize:14, fontFamily:'Georgia,serif', color:'#1C1C1E', outline:'none', boxSizing:'border-box', marginBottom:8 }} />
            {duplicaTarget && new Date(duplicaTarget + 'T12:00:00').getDay() !== 1 && (
              <div style={{ fontSize:11, color:'#E76F51', marginBottom:8 }}>{'⚠️ Seleziona un lunedì'}</div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button onClick={() => { setModaleDuplica(false); setDuplicaTarget('') }}
                style={{ flex:1, background:'#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif' }}>Annulla</button>
              <button onClick={duplicaSu}
                disabled={!duplicaTarget || new Date(duplicaTarget + 'T12:00:00').getDay() !== 1 || duplicaTarget === settKey || duplicando}
                style={{ flex:2, background:(duplicaTarget && new Date(duplicaTarget+'T12:00:00').getDay()===1 && duplicaTarget!==settKey) ? '#1C1C1E' : '#EEEAE3', border:'none', borderRadius:14, padding:'13px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:(duplicaTarget && new Date(duplicaTarget+'T12:00:00').getDay()===1 && duplicaTarget!==settKey) ? '#FDFAF6' : '#AAA', fontWeight:'bold' }}>
                {duplicando ? '...' : 'Duplica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerMod && (
        <DrawerModifica
          giornoLabel={GIORNI_FULL[GIORNI.indexOf(drawerMod.giorno)]}
          pasto={drawerMod.pasto}
          ricetteArchivio={ricetteList}
          haRicetta={!!piano[drawerMod.key]}
          onSelect={id => { salvaSlot(drawerMod.giorno, drawerMod.pasto, id); setDrawerMod(null) }}
          onRemove={() => { rimuoviSlot(drawerMod.giorno, drawerMod.pasto); setDrawerMod(null) }}
          onClose={() => setDrawerMod(null)}
        />
      )}

      {modaleSpesa && (
        <ModaleSelezioneSpesa
          piano={piano} ricetteMap={ricetteMap}
          onConferma={chiavi => { setModaleSpesa(false); setSpesaChiavi(chiavi) }}
          onClose={() => setModaleSpesa(false)}
        />
      )}

      {spesaChiavi && (
        <PannelloSpesa
          key={spesaChiavi.join(',')}
          piano={piano} ricetteMap={ricetteMap} selezione={spesaChiavi}
          onClose={() => setSpesaChiavi(null)}
        />
      )}

      <div style={{ background:'#1C1C1E', padding:'52px 18px 14px', color:'#FDFAF6', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
              <button onClick={() => setSettOffset(o => o-1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:24, height:24, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{'‹'}</button>
              <span style={{ fontSize:10, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase' }}>{rangeLabel}</span>
              <button onClick={() => setSettOffset(o => o+1)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:24, height:24, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{'›'}</button>
              {settOffset !== 0 && (
                <button onClick={tornaOggi} style={{ background:'#F4A261', border:'none', borderRadius:10, padding:'2px 8px', color:'#fff', fontSize:10, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:'bold' }}>oggi</button>
              )}
            </div>
            <div style={{ fontSize:20, fontWeight:'bold' }}>Piano settimanale</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:18, fontWeight:'bold', color:'#F4A261' }}>{nRicette}/{N_SLOT}</div>
              <div style={{ fontSize:10, color:'#A8A8A0', letterSpacing:1 }}>PASTI</div>
            </div>
            {nRicette > 0 && (
              <button onClick={() => setModaleDuplica(true)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, cursor:'pointer', fontFamily:'Georgia,serif' }}>{'⎘ Duplica'}</button>
            )}
          </div>
        </div>
        <div style={{ background:'#2C2C2E', borderRadius:4, height:4, overflow:'hidden', marginBottom:12 }}>
          <div style={{ background:'#F4A261', height:'100%', width:`${(nRicette/N_SLOT)*100}%`, borderRadius:4, transition:'width 0.4s' }} />
        </div>
        <div style={{ display:'flex', background:'#2C2C2E', borderRadius:10, padding:3 }}>
          {['settimana','giorno'].map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ flex:1, background: vista===v?'#FDFAF6':'transparent', color: vista===v?'#1C1C1E':'#A8A8A0', border:'none', borderRadius:8, padding:'6px', fontSize:11, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight: vista===v?'bold':'normal', textTransform:'uppercase', letterSpacing:1, transition:'all 0.2s' }}>
              {v === 'settimana' ? 'Settimana' : 'Giorno'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', paddingBottom:130 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#A8A8A0' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🍳</div>
            <div style={{ fontSize:13 }}>Caricamento...</div>
          </div>
        ) : (
          <React.Fragment>
            {vista === 'settimana' && (
              <div style={{ padding:'14px 14px 0' }}>
                {GIORNI.map((giorno,gi) => {
                  const isOggi = settOffset === 0 && gi === (new Date().getDay() === 0 ? 6 : new Date().getDay()-1)
                  return (
                    <div key={giorno} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background: isOggi?'#F4A261':'transparent', border: isOggi?'none':'1px solid #DDD8D0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:'bold', color: isOggi?'#fff':'#888', flexShrink:0 }}>
                          {lunedi.getDate() + gi}
                        </div>
                        <span style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color: isOggi?'#1C1C1E':'#A8A8A0', fontWeight: isOggi?'bold':'normal' }}>{GIORNI_FULL[gi]}</span>
                        {isOggi && <span style={{ fontSize:10, background:'#F4A261', color:'#fff', borderRadius:10, padding:'1px 7px', letterSpacing:1 }}>OGGI</span>}
                      </div>
                      <div style={{ marginLeft:36, display:'flex', flexDirection:'column', gap:6 }}>
                        <SlotCard ricetta={ricetteMap[piano[`${giorno}-Colazione`]]} pasto="Colazione" compact
                          onTap={() => { const id = piano[`${giorno}-Colazione`]; if(id) navigate(`/ricetta/${id}`) }}
                          onModifica={() => setDrawerMod({key:`${giorno}-Colazione`,giorno,pasto:'Colazione'})}
                          style={{ width:'100%' }} />
                        <div style={{ display:'flex', gap:6 }}>
                          <SlotCard ricetta={ricetteMap[piano[`${giorno}-Pranzo`]]} pasto="Pranzo"
                            onTap={() => { const id = piano[`${giorno}-Pranzo`]; if(id) navigate(`/ricetta/${id}`) }}
                            onModifica={() => setDrawerMod({key:`${giorno}-Pranzo`,giorno,pasto:'Pranzo'})}
                            style={{ flex:1 }} />
                          <SlotCard ricetta={ricetteMap[piano[`${giorno}-Cena`]]} pasto="Cena"
                            onTap={() => { const id = piano[`${giorno}-Cena`]; if(id) navigate(`/ricetta/${id}`) }}
                            onModifica={() => setDrawerMod({key:`${giorno}-Cena`,giorno,pasto:'Cena'})}
                            style={{ flex:1 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {vista === 'giorno' && (
              <div>
                <div style={{ display:'flex', overflowX:'auto', padding:'14px 14px 10px', gap:8, scrollbarWidth:'none' }}>
                  {GIORNI.map((g,gi) => {
                    const isOggi  = settOffset===0 && gi===(new Date().getDay()===0?6:new Date().getDay()-1)
                    const isSel   = g===giornoSel
                    const haPasti = PASTI.some(p => piano[`${g}-${p}`])
                    return (
                      <button key={g} onClick={() => setGiornoSel(g)}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', flexShrink:0, padding:'0 4px' }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background: isSel?'#1C1C1E':isOggi?'#F4A261':'#EEEAE3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:'bold', color: isSel||isOggi?'#fff':'#1C1C1E', transition:'all 0.2s' }}>
                          {lunedi.getDate()+gi}
                        </div>
                        <span style={{ fontSize:10, color:isSel?'#1C1C1E':'#A8A8A0', textTransform:'uppercase', letterSpacing:1, fontWeight:isSel?'bold':'normal' }}>{g}</span>
                        <div style={{ width:4, height:4, borderRadius:'50%', background: haPasti?'#F4A261':'transparent' }} />
                      </button>
                    )
                  })}
                </div>
                <div style={{ padding:'0 18px 14px', borderBottom:'1px solid #EEE9E2' }}>
                  <div style={{ fontSize:18, fontWeight:'bold', color:'#1C1C1E' }}>{GIORNI_FULL[idxGiorno]}</div>
                  <div style={{ fontSize:11, color:'#A8A8A0', marginTop:2 }}>{lunedi.getDate()+idxGiorno} — {rangeLabel.split('–')[1]?.trim()}</div>
                </div>
                <div style={{ padding:'14px 18px 0' }}>
                  {PASTI.map(pasto => {
                    const key     = `${giornoSel}-${pasto}`
                    const ricetta = ricetteMap[piano[key]]
                    const isColazione = pasto === 'Colazione'
                    return (
                      <div key={pasto} style={{ marginBottom:14 }}>
                        <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                          <span>{PASTO_EMOJI[pasto]}</span> {pasto}
                        </div>
                        <button
                          onClick={() => ricetta ? navigate(`/ricetta/${piano[key]}`) : setDrawerMod({key,giorno:giornoSel,pasto})}
                          style={{ width:'100%', border:'none', cursor:'pointer', borderRadius:18, textAlign:'left', boxSizing:'border-box', transition:'opacity 0.15s', background: ricetta ? (CAT_COLORS[ricetta.categoria]||'#F4A261') : '#EEEAE3', padding: ricetta ? (isColazione?'12px 16px':'16px 18px') : (isColazione?'14px 16px':'20px 18px'), position:'relative' }}
                          onTouchStart={e => e.currentTarget.style.opacity='0.85'} onTouchEnd={e => e.currentTarget.style.opacity='1'}>
                          {ricetta ? (
                            <React.Fragment>
                              <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', letterSpacing:2, textTransform:'uppercase', marginBottom: isColazione?3:5 }}>{ricetta.categoria}</div>
                              <div style={{ fontSize: isColazione?14:17, fontWeight:'bold', color:'#fff', fontFamily:'Georgia,serif', marginBottom: isColazione?4:8, lineHeight:1.3 }}>{ricetta.titolo}</div>
                              <div style={{ display:'flex', gap:8 }}>
                                {ricetta.tempo_minuti && <span style={{ background:'rgba(0,0,0,0.2)', color:'#fff', borderRadius:20, padding:'4px 10px', fontSize:11 }}>{'⏱ ' + ricetta.tempo_minuti + ' min'}</span>}
                                <span onClick={e => { e.stopPropagation(); setDrawerMod({key,giorno:giornoSel,pasto}) }}
                                  style={{ background:'rgba(0,0,0,0.2)', color:'rgba(255,255,255,0.85)', borderRadius:20, padding:'4px 10px', fontSize:11, cursor:'pointer' }}>{'✎ Cambia'}</span>
                              </div>
                            </React.Fragment>
                          ) : (
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:28, height:28, borderRadius:'50%', background:'#D8D3CB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff' }}>+</div>
                              <span style={{ fontSize:13, color:'#B0AB9F', fontFamily:'Georgia,serif' }}>{'Aggiungi ' + pasto.toLowerCase() + '…'}</span>
                            </div>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#FDFAF6', borderTop:'1px solid #E8E3DC', zIndex:100 }}>
        <div style={{ padding:'10px 14px 6px' }}>
          <button onClick={() => { setSpesaChiavi(null); setModaleSpesa(true) }}
            style={{ width:'100%', background:'#1C1C1E', border:'none', borderRadius:14, padding:'11px', fontSize:12, cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            {'🛒 Lista della spesa'}
          </button>
        </div>
        <div style={{ display:'flex', justifyContent:'space-around', alignItems:'center', padding:'6px 8px 28px' }}>
          {[{key:'home',icon:'⌂',label:'Home',path:'/'},{key:'piano',icon:'◫',label:'Piano',active:true},{center:true},{key:'costi',icon:'⚡',label:'Costi',path:'/costi'},{key:'profilo',icon:'◯',label:'Profilo',path:'/profilo'}]
            .map((item,i) => item.center ? (
              <button key={i} onClick={() => navigate('/nuova')} style={{ background:'#1C1C1E', borderRadius:'50%', width:52, height:52, border:'none', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:28, marginTop:-20, boxShadow:'0 4px 16px rgba(0,0,0,0.25)', cursor:'pointer' }}>+</button>
            ) : (
              <button key={i} onClick={() => !item.active && navigate(item.path)} style={{ background:'transparent', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 12px' }}>
                <span style={{ fontSize:20, color: item.active?'#1C1C1E':'#A8A8A0' }}>{item.icon}</span>
                <span style={{ fontSize:10, color: item.active?'#1C1C1E':'#A8A8A0', fontFamily:'Georgia,serif' }}>{item.label}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
