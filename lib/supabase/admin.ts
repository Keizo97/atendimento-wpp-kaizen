// Cliente Supabase com service role: IGNORA o RLS.
// SO pode ser importado em codigo de servidor (rotas de API, server actions).
// NUNCA importar em componente "use client".
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
