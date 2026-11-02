import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const s = {
  wrap: { minHeight:'100vh', background:'#1C1C1E', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px' },
  logo: { fontSize:48, marginBottom:16 },
  title: { fontSize:28, fontWeight:'bold', color:'#FDFAF6', marginBottom:6, fontFamily:'Georgia,serif' },
  sub: { fontSize:13, color:'#A8A8A0', marginBottom:40, fontFamily:'Georgia,serif' },
  card: { background:'#2C2C2E', borderRadius:24, padding:'28px 24px', width:'100%', maxWidth:360 },
  label: { fontSize:11, letterSpacing:2, color:'#A8A8A0', textTransform:'uppercase', marginBottom:6, display:'block' },
  input: { width:'100%', background:'#3A3A3C', border:'none', borderRadius:12, padding:'12px 16px', fontSize:14, color:'#FDFAF6', outline:'none', marginBottom:16, fontFamily:'Georgia,serif', boxSizing:'border-box' },
  btn: { width:'100%', background:'#F4A261', border:'none', borderRadius:14, padding:'14px', fontSize:14, fontWeight:'bold', color:'#1C1C1E', marginTop:8, fontFamily:'Georgia,serif', cursor:'pointer' },
  err: { fontSize:12, color:'#E76F51', marginTop:4, marginBottom:8, textAlign:'center', fontFamily:'Georgia,serif' },
  ok:  { fontSize:12, color:'#5CB85C', marginTop:4, marginBottom:8, textAlign:'center', fontFamily:'Georgia,serif' },
  link: { color:'#F4A261', textDecoration:'underline', cursor:'pointer' },
}

export default function Login() {
  const [schermata, setSchermata] = useState('login') // login | register | reset | nuova_password
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [nuovaPass,   setNuovaPass]   = useState('')
  const [confermaPass,setConfermaPass]= useState('')
  const [nome,        setNome]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [info,        setInfo]        = useState('')

  // Intercetta il token di reset dall'URL
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      setSchermata('nuova_password')
      // Pulisce l'URL senza ricaricare la pagina
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const reset = () => { setError(''); setInfo('') }

  const handleLogin = async (e) => {
    e.preventDefault()
    reset(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o password non corretti.')
    setLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    reset(); setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { nome } } })
    if (error) setError(error.message)
    else setInfo('Controlla la tua email per confermare la registrazione.')
    setLoading(false)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    reset(); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setError(error.message)
    else setInfo('Email inviata! Controlla la tua casella e clicca il link per reimpostare la password.')
    setLoading(false)
  }

  const handleNuovaPassword = async (e) => {
    e.preventDefault()
    reset()
    if (nuovaPass.length < 6) { setError('La password deve essere di almeno 6 caratteri.'); return }
    if (nuovaPass !== confermaPass) { setError('Le password non coincidono.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: nuovaPass })
    if (error) setError(error.message)
    else { setInfo('Password aggiornata! Puoi ora accedere.'); setTimeout(() => setSchermata('login'), 2000) }
    setLoading(false)
  }

  // ── Schermata nuova password (dopo click link email) ──
  // Uso un vero <form> con autocomplete="new-password": è quello che fa sì che
  // Chrome/Google offrano di salvare/aggiornare la password nell'account.
  if (schermata === 'nuova_password') return (
    <div style={s.wrap}>
      <div style={s.logo}>🔐</div>
      <div style={s.title}>Nuova password</div>
      <div style={s.sub}>Scegli una password sicura</div>
      <form style={s.card} onSubmit={handleNuovaPassword} autoComplete="on">
        <label style={s.label}>Nuova password</label>
        <input style={s.input} type="password" name="new-password" autoComplete="new-password" placeholder="Minimo 6 caratteri" value={nuovaPass} onChange={e => setNuovaPass(e.target.value)} />
        <label style={s.label}>Conferma password</label>
        <input style={s.input} type="password" name="new-password-confirm" autoComplete="new-password" placeholder="Ripeti la password" value={confermaPass} onChange={e => setConfermaPass(e.target.value)} />
        {error && <div style={s.err}>{error}</div>}
        {info  && <div style={s.ok}>{info}</div>}
        <button type="submit" style={s.btn} disabled={loading}>
          {loading ? '...' : 'Imposta nuova password'}
        </button>
      </form>
    </div>
  )

  // ── Schermata reset password ──
  if (schermata === 'reset') return (
    <div style={s.wrap}>
      <div style={s.logo}>🔑</div>
      <div style={s.title}>Reimposta password</div>
      <div style={s.sub}>Ti mandiamo un link via email</div>
      <form style={s.card} onSubmit={handleReset} autoComplete="on">
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" name="email" autoComplete="email" placeholder="email@esempio.com" value={email} onChange={e => setEmail(e.target.value)} />
        {error && <div style={s.err}>{error}</div>}
        {info  && <div style={s.ok}>{info}</div>}
        <button type="submit" style={s.btn} disabled={loading}>
          {loading ? '...' : 'Invia link di reset'}
        </button>
        <div style={{ textAlign:'center', marginTop:16, fontFamily:'Georgia,serif', fontSize:12, color:'#A8A8A0' }}>
          <span style={s.link} onClick={() => { setSchermata('login'); reset() }}>← Torna al login</span>
        </div>
      </form>
    </div>
  )

  // ── Schermata login / register ──
  // Un vero <form> (non solo pulsanti con onClick) con i giusti attributi
  // autocomplete è ciò che permette a Chrome/Google di riconoscere questo come
  // un modulo di accesso e offrire di salvare email+password nell'account.
  return (
    <div style={s.wrap}>
      <div style={s.logo}>🍳</div>
      <div style={s.title}>Le mie ricette</div>
      <div style={s.sub}>{schermata === 'register' ? 'Crea il tuo account' : 'Bentornata!'}</div>
      <form style={s.card} onSubmit={schermata === 'login' ? handleLogin : handleRegister} autoComplete="on">
        {schermata === 'register' && (
          <>
            <label style={s.label}>Nome</label>
            <input style={s.input} name="name" autoComplete="name" placeholder="Il tuo nome" value={nome} onChange={e => setNome(e.target.value)} />
          </>
        )}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" name="email" autoComplete="email" placeholder="email@esempio.com" value={email} onChange={e => setEmail(e.target.value)} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" name="password" autoComplete={schermata === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={s.err}>{error}</div>}
        {info  && <div style={s.ok}>{info}</div>}
        <button type="submit" style={s.btn} disabled={loading}>
          {loading ? '...' : schermata === 'login' ? 'Accedi' : 'Registrati'}
        </button>
        {schermata === 'login' && (
          <div style={{ textAlign:'center', marginTop:12, fontFamily:'Georgia,serif', fontSize:12 }}>
            <span style={s.link} onClick={() => { setSchermata('reset'); reset() }}>Password dimenticata?</span>
          </div>
        )}
        <div style={{ textAlign:'center', marginTop:12, fontFamily:'Georgia,serif', fontSize:12, color:'#A8A8A0' }}>
          {schermata === 'register' ? 'Hai già un account? ' : 'Non hai un account? '}
          <span style={s.link} onClick={() => { setSchermata(schermata==='login'?'register':'login'); reset() }}>
            {schermata === 'login' ? 'Registrati' : 'Accedi'}
          </span>
        </div>
      </form>
    </div>
  )
}
