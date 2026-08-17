// Cliente Supabase para componentes do navegador ("use client").
// Usado principalmente pelo Realtime da tela de atendimento.
//
// Singleton: cada createBrowserClient() novo abre seu proprio WebSocket de
// Realtime. Se dois componentes chamarem createClient() separadamente, o
// segundo pode nao ter o token de auth propagado a tempo antes do primeiro
// evento chegar, e o Realtime passa a ignorar tudo em silencio (sem erro).
// Por isso todo componente do navegador deve usar essa MESMA instancia.
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export function createClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
