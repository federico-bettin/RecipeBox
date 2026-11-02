import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy } from 'react'
import { supabase } from './lib/supabase'

const Home        = lazy(() => import('./pages/Home.jsx'))
const Archivio    = lazy(() => import('./pages/Archivio.jsx'))
const Ricetta     = lazy(() => import('./pages/Ricetta.jsx'))
const FormRicetta = lazy(() => import('./pages/FormRicetta.jsx'))
const Piano       = lazy(() => import('./pages/Piano.jsx'))
const Profilo     = lazy(() => import('./pages/Profilo.jsx'))
const Login       = lazy(() => import('./pages/Login.jsx'))
const CostiApi    = lazy(() => import('./pages/CostiApi.jsx'))
const Cestino     = lazy(() => import('./pages/Cestino.jsx'))

function MenuNuova({ onClose }) {
  const navigate = useNavigate()

  const voci = [
    { emoji:'✏️', label:'Inserimento manuale', sub:'Compila il form a mano',            action: () => { onClose(); navigate('/nuova') } },
    { emoji:'🔗', label:'Importa da URL',       sub:'Incolla il link di una ricetta web', action: () => { onClose(); navigate('/nuova?import=url') } },
    { emoji:'📷', label:'Fotografa',            sub:'Scatta una foto alla ricetta',       action: () => { onClose(); navigate('/nuova?import=camera') } },
    { emoji:'📄', label:'Importa da file',      sub:'Foto, PDF, Word, screenshot…',       action: () => { onClose(); navigate('/nuova?import=file') } },
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.5)', cursor:'pointer' }} />
      <div style={{ background:'#FDFAF6', borderRadius:'24px 24px 0 0', padding:'16px 18px 40px', boxShadow:'0 -8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <div style={{ width:36, height:4, background:'#DDDAD5', borderRadius:2 }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:'bold', color:'#1C1C1E', fontFamily:'Georgia,serif' }}>Nuova ricetta</div>
          <button onClick={onClose} style={{ background:'#EEEAE3', border:'none', borderRadius:'50%', width:28, height:28, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#888' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {voci.map((v, i) => (
            <button key={i} onClick={v.action}
              style={{ background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:'Georgia,serif', textAlign:'left', width:'100%' }}>
              <span style={{ fontSize:24 }}>{v.emoji}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:'bold', color:'#1C1C1E' }}>{v.label}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{v.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [session,    setSession]    = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
  const [showMenu,   setShowMenu]   = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lettura una tantum dell'URL all'avvio
    if (window.location.hash.includes('type=recovery')) setIsRecovery(true)
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      setSession(session)
    })
    // Ascolta evento dal BottomNav
    const handler = () => setShowMenu(true)
    window.addEventListener('openMenuNuova', handler)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('openMenuNuova', handler)
    }
  }, [])

  if (session === undefined) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#1C1C1E' }}>
      <div style={{ color:'#F4A261', fontSize:32 }}>🍳</div>
    </div>
  )

  if (isRecovery) return <Login />

  if (!session) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  return (
    <>
      {showMenu && <MenuNuova onClose={() => setShowMenu(false)} />}
      <Routes>
        <Route path="/"             element={<Home />} />
        <Route path="/archivio"     element={<Archivio />} />
        <Route path="/ricetta/:id"  element={<Ricetta />} />
        <Route path="/nuova"        element={<FormRicetta />} />
        <Route path="/modifica/:id" element={<FormRicetta />} />
        <Route path="/piano"        element={<Piano />} />
        <Route path="/profilo"      element={<Profilo />} />
        <Route path="/costi"        element={<CostiApi />} />
        <Route path="/cestino"      element={<Cestino />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
