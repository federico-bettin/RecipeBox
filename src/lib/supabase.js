import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://omyieafskwzcnskokerv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teWllYWZza3d6Y25za29rZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzMxNzUsImV4cCI6MjA5NjY0OTE3NX0.Mj7kLIltASK7rrIJOUOXV5a4D-2HgxqmKhbXb7LVRys'

export const supabase = createClient(supabaseUrl, supabaseKey)
