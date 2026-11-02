import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { registraServiceWorker } from './lib/push'
import './index.css'

// Registra il service worker per le notifiche push. Non chiede alcun permesso
// qui — la richiesta di permesso avviene solo quando l'utente avvia il primo
// timer di cottura, in Ricetta.jsx.
registraServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#1C1C1E' }}>
          <div style={{ color:'#F4A261', fontSize:32 }}>🍳</div>
        </div>
      }>
        <App />
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
)
