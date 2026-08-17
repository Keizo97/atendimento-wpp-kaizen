// Upsert de cliente e busca/criacao da conversa aberta.
// Usa o cliente admin (service role) porque o webhook nao tem sessao de usuario.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function upsertCliente(
  admin: SupabaseClient,
  telefone: string,
  nome?: string | null
) {
  const { data: existente } = await admin
    .from('yumiwpp_clientes')
    .select('telefone, total_mensagens, nome')
    .eq('telefone', telefone)
    .maybeSingle()

  if (existente) {
    await admin
      .from('yumiwpp_clientes')
      .update({
        ultimo_contato: new Date().toISOString(),
        total_mensagens: existente.total_mensagens + 1,
        nome: existente.nome ?? nome ?? null,
      })
      .eq('telefone', telefone)
    return
  }

  await admin.from('yumiwpp_clientes').insert({
    telefone,
    nome: nome ?? null,
    total_mensagens: 1,
  })
}

export async function conversaAberta(
  admin: SupabaseClient,
  telefone: string
): Promise<{ id: string; modo: 'bot' | 'humano' }> {
  const { data: existente } = await admin
    .from('yumiwpp_conversas')
    .select('id, modo')
    .eq('telefone', telefone)
    .eq('status', 'aberta')
    .maybeSingle()

  if (existente) return existente

  const { data: nova, error } = await admin
    .from('yumiwpp_conversas')
    .insert({ telefone })
    .select('id, modo')
    .single()

  if (error) throw error
  return nova
}
