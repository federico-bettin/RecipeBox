import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav.jsx'

const DIETE = ["Vegano","Vegetariano","Senza glutine","Senza lattosio"]

export default function Profilo() {
  const navigate = useNavigate()
  const [, setProfile]   = useState(null)
  const [email,     setEmail]     = useState('')
  const [nome,      setNome]      = useState('')
  const [diete,     setDiete]     = useState([])
  const [nRicette,  setNRicette]  = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) { setProfile(p); setNome(p.nome || ''); setDiete(p.diete || []) }
      const { count } = await supabase.from('recipes').select('*', { count:'exact', head:true })
      setNRicette(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  const salva = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ nome: nome.trim(), diete }).eq('id', user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const toggleDieta = d => setDiete(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:28, color:'#A8A8A0' }}>🍳</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif' }}>

      {/* Header */}
      <div style={{ background:'#1C1C1E', padding:'52px 20px 24px', color:'#FDFAF6', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Avatar */}
          <div style={{ width:60, height:60, borderRadius:'50%', background:'#F4A261', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
            {nome ? nome[0].toUpperCase() : '👤'}
          </div>
          <div>
            <div style={{ fontSize:20, fontWeight:'bold' }}>{nome || 'Il mio profilo'}</div>
            <div style={{ fontSize:12, color:'#A8A8A0', marginTop:2 }}>{email}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:0, marginTop:20, background:'#2C2C2E', borderRadius:14, overflow:'hidden' }}>
          <div style={{ flex:1, padding:'12px', textAlign:'center', borderRight:'1px solid #3A3A3C' }}>
            <div style={{ fontSize:22, fontWeight:'bold', color:'#F4A261' }}>{nRicette}</div>
            <div style={{ fontSize:10, color:'#A8A8A0', letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>Ricette</div>
          </div>
          <div style={{ flex:1, padding:'12px', textAlign:'center', borderRight:'1px solid #3A3A3C' }}>
            <div style={{ fontSize:22, fontWeight:'bold', color:'#F4A261' }}>{diete.length}</div>
            <div style={{ fontSize:10, color:'#A8A8A0', letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>Filtri dieta</div>
          </div>
          <div style={{ flex:1, padding:'12px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:'bold', color:'#F4A261' }}>∞</div>
            <div style={{ fontSize:10, color:'#A8A8A0', letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>Settimane</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 18px 100px' }}>

        {/* Nome */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:6, display:'block' }}>Nome</label>
          <input value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Come ti chiami?"
            style={{ background:'#EEEAE3', border:'none', borderRadius:10, padding:'11px 14px', fontSize:14, fontFamily:'Georgia,serif', color:'#1C1C1E', outline:'none', width:'100%', boxSizing:'border-box' }} />
        </div>

        {/* Email (sola lettura) */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:6, display:'block' }}>Email</label>
          <div style={{ background:'#EEEAE3', borderRadius:10, padding:'11px 14px', fontSize:14, color:'#888', fontFamily:'Georgia,serif' }}>
            {email}
          </div>
        </div>

        {/* Preferenze dieta */}
        <div style={{ marginBottom:24 }}>
          <label style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:6, display:'block' }}>Preferenze dieta</label>
          <div style={{ fontSize:12, color:'#A8A8A0', marginBottom:10, fontFamily:'Georgia,serif' }}>
            Usate come filtri predefiniti nell'archivio
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {DIETE.map(d => (
              <button key={d} onClick={() => toggleDieta(d)} style={{
                background: diete.includes(d) ? '#1C1C1E' : '#EEEAE3',
                color: diete.includes(d) ? '#fff' : '#1C1C1E',
                border:'none', borderRadius:20, padding:'8px 16px',
                fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif',
                fontWeight: diete.includes(d) ? 'bold' : 'normal', transition:'all 0.15s',
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Salva */}
        <button onClick={salva} disabled={saving} style={{
          width:'100%', background: saved ? '#2D6A2D' : '#1C1C1E',
          border:'none', borderRadius:14, padding:'14px', fontSize:14,
          cursor:'pointer', fontFamily:'Georgia,serif', color:'#FDFAF6',
          fontWeight:'bold', marginBottom:12, transition:'background 0.3s',
        }}>
          {saved ? '✓ Salvato' : saving ? '...' : 'Salva modifiche'}
        </button>

        {/* Separatore */}
        <div style={{ height:1, background:'#E8E3DC', margin:'20px 0' }} />

        {/* Sezione app */}
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:12 }}>App</div>

          <button onClick={() => navigate('/archivio')} style={{ width:'100%', background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', textAlign:'left', display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span style={{ fontSize:18 }}>≡</span>
            <span>Le mie ricette</span>
            <span style={{ marginLeft:'auto', color:'#A8A8A0', fontSize:16 }}>›</span>
          </button>

          <button onClick={() => navigate('/piano')} style={{ width:'100%', background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', textAlign:'left', display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span style={{ fontSize:18 }}>◫</span>
            <span>Piano settimanale</span>
            <span style={{ marginLeft:'auto', color:'#A8A8A0', fontSize:16 }}>›</span>
          </button>

          <button onClick={() => navigate('/cestino')} style={{ width:'100%', background:'#EEEAE3', border:'none', borderRadius:14, padding:'14px 16px', fontSize:13, cursor:'pointer', fontFamily:'Georgia,serif', color:'#1C1C1E', textAlign:'left', display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span style={{ fontSize:18 }}>🗑</span>
            <span>Cestino</span>
            <span style={{ marginLeft:'auto', color:'#A8A8A0', fontSize:16 }}>›</span>
          </button>
        </div>

        {/* Logout */}
        <div style={{ height:1, background:'#E8E3DC', margin:'20px 0' }} />
        <button onClick={logout} style={{
          width:'100%', background:'#FFF0F0', border:'1px solid #FDD',
          borderRadius:14, padding:'14px', fontSize:13,
          cursor:'pointer', fontFamily:'Georgia,serif', color:'#E76F51', fontWeight:'bold',
        }}>
          Esci dall'account
        </button>
      </div>

      <BottomNav active="profilo" />
    </div>
  )
}
