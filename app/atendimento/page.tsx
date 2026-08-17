import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/auth'
import Inbox from '@/components/atendimento/Inbox'
import type { ConversaRow } from '@/components/atendimento/types'

export default async function AtendimentoPage() {
  const supabase = await createClient()
  const perfil = await getPerfil()

  const { data: conversas } = await supabase
    .from('yumiwpp_conversas')
    .select(
      'id, telefone, modo, status, assumido_por, updated_at, yumiwpp_clientes(nome), atendente:yumiwpp_profiles(nome)'
    )
    .eq('status', 'aberta')
    .order('updated_at', { ascending: false })

  return (
    <Inbox
      conversasIniciais={(conversas as unknown as ConversaRow[]) ?? []}
      meuId={perfil?.id ?? ''}
    />
  )
}
