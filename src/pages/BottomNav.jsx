import { useNavigate } from 'react-router-dom'

export default function BottomNav({ active }) {
  const navigate = useNavigate()

  const items = [
    { key: 'home',     icon: '⌂', label: 'Home',     path: '/' },
    { key: 'archivio', icon: '≡', label: 'Archivio',  path: '/archivio' },
    { key: 'center',   center: true },
    { key: 'piano',    icon: '◫', label: 'Piano',    path: '/piano' },
    { key: 'profilo',  icon: '◯', label: 'Profilo',   path: '/profilo' },
  ]

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#FDFAF6', borderTop: '1px solid #E8E3DC',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '12px 8px 28px', zIndex: 100,
    }}>
      {items.map(item => item.center ? (
        <button key="center" onClick={() => navigate('/nuova')} style={{
          background: '#1C1C1E', color: '#FDFAF6', border: 'none',
          borderRadius: '50%', width: 52, height: 52, fontSize: 28,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginTop: -20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', lineHeight: 1,
        }}>+</button>
      ) : (
        <button key={item.key} onClick={() => navigate(item.path)} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, padding: '4px 12px',
        }}>
          <span style={{ fontSize: 20, color: active === item.key ? '#1C1C1E' : '#A8A8A0' }}>{item.icon}</span>
          <span style={{ fontSize: 10, color: active === item.key ? '#1C1C1E' : '#A8A8A0', fontFamily: 'Georgia, serif', letterSpacing: 0.5 }}>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
