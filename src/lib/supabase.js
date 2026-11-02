import { createClient } from '@supabase/supabase-js'

// URL e chiave "anon" arrivano dalle variabili d'ambiente (vedi .env.example).
// La chiave anon è pensata per stare nel browser: i dati sono protetti dalle
// policy RLS di Supabase, non dal tenerla nascosta.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Mancano VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY. Copia .env.example in .env.local e compilalo.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
