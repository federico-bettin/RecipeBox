// ─── Intelligenza artificiale: ognuno usa la propria chiave ──────────────────
// L'app usa Claude (Anthropic) per importare ricette da link, foto e PDF. Ha un
// costo per ogni richiesta, quindi lo paga chi lo usa: ogni utente incolla la
// propria chiave Anthropic nel Profilo. L'app non ha una chiave propria.
// Senza la chiave tutto il resto dell'app funziona normalmente.

const CHIAVE_STORAGE = 'recipebox.anthropicKey'

export function leggiChiaveUtente() {
  try { return localStorage.getItem(CHIAVE_STORAGE) || '' } catch { return '' }
}

// La chiave resta solo in questo browser: non viene mai salvata sul database.
export function salvaChiaveUtente(chiave) {
  try { localStorage.setItem(CHIAVE_STORAGE, chiave.trim()); return true } catch { return false }
}

export function rimuoviChiaveUtente() {
  try { localStorage.removeItem(CHIAVE_STORAGE) } catch { /* niente da fare */ }
}

export function chiaveValida(chiave) {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test((chiave || '').trim())
}

// { haChiave, disponibile }: l'AI è disponibile solo con la chiave personale.
export async function statoAi() {
  const haChiave = chiaveValida(leggiChiaveUtente())
  return { haChiave, disponibile: haChiave }
}

// Spiega in italiano gli errori che arrivano dalle funzioni AI.
export function spiegaErroreAi(msg) {
  if (!msg) return null
  if (msg.includes('CHIAVE_ANTHROPIC_MANCANTE')) return 'Per importare serve la tua chiave Anthropic: aggiungila nel Profilo, oppure inserisci la ricetta a mano.'
  if (msg.includes('CHIAVE_ANTHROPIC_NON_VALIDA')) return 'La chiave Anthropic non è valida. Controllala nel Profilo.'
  if (msg.includes('CREDITO_ANTHROPIC_ESAURITO')) return 'Il credito sul tuo account Anthropic è esaurito. Ricaricalo su console.anthropic.com e riprova.'
  if (msg.includes('ANTHROPIC_TROPPE_RICHIESTE')) return 'Troppe richieste in poco tempo. Aspetta un minuto e riprova.'
  if (msg.includes('FORMATO_NON_SUPPORTATO')) return 'Formato non supportato. Usa una foto JPG, PNG o WebP, oppure un PDF.'
  if (msg.includes('FILE_TROPPO_GRANDE')) return 'Il file è troppo grande (massimo 10 MB).'
  return null
}
