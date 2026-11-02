// Parole chiave per riconoscere ingredienti della "famiglia uova" (uova/tuorli/albumi).
// Condivisa tra: scaling delle porzioni (Ricetta.jsx) e filtro ingredienti generico
// (Home.jsx, Archivio.jsx), per evitare disallineamenti tra i due usi.
export const UOVA_KEYWORDS = ['uov', 'tuorl', 'album']

// Nome "generico" di un ingrediente, usato per popolare le liste filtro e per il
// matching nei filtri di ricerca. Esempi:
//   "Caffè caldo molto ristretto" -> "Caffè"
//   "Farina 00" / "Farina integrale" -> "Farina"
//   "Albumi" / "Tuorli" / "Uova" -> "Uova"
export function nomeGenerico(nomeCompleto) {
  const trimmed = (nomeCompleto || '').trim()
  if (!trimmed) return ''
  const lower = trimmed.toLowerCase()
  if (UOVA_KEYWORDS.some(k => lower.includes(k))) return 'Uova'
  const primaParola = trimmed.split(/\s+/)[0]
  return primaParola.charAt(0).toUpperCase() + primaParola.slice(1).toLowerCase()
}

// Normalizza il nome di un ingrediente prima di salvarlo: prima lettera maiuscola,
// tutte le altre minuscole (es. "FARINA 00" -> "Farina 00", "olio EVO" -> "Olio evo").
export function normalizzaIngrediente(nome) {
  const trimmed = (nome || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

// Forme plurali delle unità di misura selezionabili nel form (elenco chiuso,
// quindi un dizionario è più affidabile di una regola generica). Le unità non
// presenti qui (g, kg, ml, l, q.b.) non cambiano forma al plurale.
const PLURALI_UNITA = {
  cucchiaio: 'cucchiai',
  cucchiaino: 'cucchiaini',
  tazza: 'tazze',
  bustina: 'bustine',
  pizzico: 'pizzichi',
  stecca: 'stecche',
  rametto: 'rametti',
  foglia: 'foglie',
}

// Restituisce l'unità di misura nella forma corretta in base alla quantità:
// singolare se <= 1 (o quantità mancante), plurale se > 1.
export function formattaUnita(unita, quantita) {
  if (!unita) return ''
  const q = parseFloat(quantita)
  if (isNaN(q) || q <= 1) return unita
  return PLURALI_UNITA[unita.toLowerCase()] || unita
}
