// Avisa os atendentes cadastrados no WhatsApp quando a Yumi escala pra humano.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarMensagem } from './zapi'

export async function notificarAtendentes(
  admin: SupabaseClient,
  params: {
    telefoneCliente: string
    motivo: string
    prioridade: 'normal' | 'urgente'
    resumo: string
  }
) {
  const { data: atendentes } = await admin
    .from('yumiwpp_atendentes')
    .select('numero')
    .eq('ativo', true)

  if (!atendentes || atendentes.length === 0) return

  const prefixo = params.prioridade === 'urgente' ? '🚨 URGENTE — ' : ''
  const texto = `${prefixo}Cliente pediu atendimento humano
Telefone: ${params.telefoneCliente}
Motivo: ${params.motivo}
Resumo: ${params.resumo || 'sem detalhe'}`

  await Promise.all(atendentes.map((a) => enviarMensagem(a.numero, texto)))
}
