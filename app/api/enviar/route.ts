// Saida manual: usada pela tela de atendimento quando o gerente responde.
// Autenticada por sessao (cookie), nao pelo secret do webhook.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarMensagem } from '@/lib/whatsapp/zapi'
import { getPerfil } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil || (perfil.role !== 'gerente' && perfil.role !== 'admin')) {
    return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const conversaId = body?.conversaId ? String(body.conversaId) : null
  const telefone = body?.telefone ? String(body.telefone) : null
  const texto = body?.texto ? String(body.texto).trim() : ''

  if (!conversaId || !telefone || !texto) {
    return NextResponse.json(
      { erro: 'conversaId, telefone e texto sao obrigatorios' },
      { status: 400 }
    )
  }

  const envio = await enviarMensagem(telefone, texto)
  if (!envio.ok) {
    return NextResponse.json({ erro: envio.erro }, { status: 502 })
  }

  const supabase = await createClient()
  const { data: mensagem, error } = await supabase
    .from('yumiwpp_mensagens')
    .insert({
      conversa_id: conversaId,
      telefone,
      autor: 'gerente',
      texto,
      zapi_message_id: envio.messageId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mensagem })
}
