import React from 'react'
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
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
