// Entrada do WhatsApp. Publica, mas validada por ?secret= na URL do webhook.
// Configurar no painel Z-API: https://SEU_DOMINIO/api/webhook/zapi?secret=ZAPI_WEBHOOK_SECRET
// Ligar tambem o webhook "notifySentByMe" (mesma URL) pra pegar mensagens
// digitadas direto no celular do numero conectado.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagem } from '@/lib/whatsapp/zapi'
import { upsertCliente, conversaAberta } from '@/lib/whatsapp/clientes'
import { buscarValoresTexto } from '@/lib/yumi/valores'
import { gerarResposta, type MensagemHistorico } from '@/lib/yumi/responder'
import { registrarUso } from '@/lib/yumi/custo'
import { notificarAtendentes } from '@/lib/whatsapp/notificar'

const CONTEXTO_MENSAGENS = Number(process.env.YUMI_CONTEXT_MESSAGES) || 20
const MENSAGEM_ESCALADA = 'Ja estou chamando alguem pra te ajudar, so um instante 🙏'

// Payload padrao do evento "on-message-received" da Z-API.
// Ainda nao validado com um webhook real: se algum campo vier diferente,
// ajustar aqui (o corpo cru pode ser logado abaixo em caso de duvida).
type PayloadZapi = {
  type?: string
  fromMe?: boolean
  phone?: string
  messageId?: string
  chatName?: string
  senderName?: string
  text?: { message?: string }
  image?: unknown
  audio?: unknown
  video?: unknown
  document?: unknown
}

function extrairTexto(body: PayloadZapi): string | null {
  if (body.text?.message) return body.text.message
  if (body.image) return '[imagem]'
  if (body.audio) return '[audio]'
  if (body.video) return '[video]'
  if (body.document) return '[documento]'
  return null
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (!process.env.ZAPI_WEBHOOK_SECRET || secret !== process.env.ZAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as PayloadZapi | null

  // Ignora callbacks que nao sao mensagem (status de entrega, leitura, conexao, etc.)
  if (!body || body.type !== 'ReceivedCallback') {
    return NextResponse.json({ ok: true })
  }

  const telefone = body.phone ? String(body.phone) : ''
  const messageId = body.messageId ? String(body.messageId) : null
  if (!telefone) return NextResponse.json({ ok: true })

  const admin = createAdminClient()

  // Eco de mensagem enviada pelo proprio numero conectado.
  if (body.fromMe === true) {
    if (messageId) {
      const { data: jaExiste } = await admin
        .from('yumiwpp_mensagens')
        .select('id')
        .eq('zapi_message_id', messageId)
        .maybeSingle()
      // Eco do que a Yumi ou o gerente ja mandaram pelo app: ignora.
      if (jaExiste) return NextResponse.json({ ok: true })
    }

    // Nao esta no banco: foi digitado direto no celular. Takeover automatico.
    const texto = extrairTexto(body)
    if (!texto) return NextResponse.json({ ok: true })

    await upsertCliente(admin, telefone, body.chatName ?? null)
    const conversa = await conversaAberta(admin, telefone)

    await admin.from('yumiwpp_mensagens').insert({
      conversa_id: conversa.id,
      telefone,
      autor: 'gerente',
      texto,
      zapi_message_id: messageId,
    })

    if (conversa.modo !== 'humano') {
      await admin.from('yumiwpp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
    }

    return NextResponse.json({ ok: true })
  }

  // Mensagem real do cliente.
  const texto = extrairTexto(body)
  if (!texto) return NextResponse.json({ ok: true })

  await upsertCliente(admin, telefone, body.senderName ?? body.chatName ?? null)
  const conversa = await conversaAberta(admin, telefone)

  const { error: erroInsercao } = await admin.from('yumiwpp_mensagens').insert({
    conversa_id: conversa.id,
    telefone,
    autor: 'cliente',
    texto,
    zapi_message_id: messageId,
  })

  if (erroInsercao) {
    // 23505 = unique_violation: webhook duplicado da Z-API, ja processado antes.
    if (erroInsercao.code === '23505') return NextResponse.json({ ok: true })
    console.error('[webhook zapi] erro ao gravar mensagem do cliente:', erroInsercao.message)
    return NextResponse.json({ ok: true })
  }

  // Conversa ja esta com humano: so grava, nao responde.
  if (conversa.modo !== 'bot') {
    return NextResponse.json({ ok: true })
  }

  const [{ data: config }, valoresTexto, { data: historicoBruto }] = await Promise.all([
    admin
      .from('yumiwpp_config')
      .select('system_prompt, knowledge_base, modelo')
      .eq('id', 1)
      .maybeSingle(),
    buscarValoresTexto(admin),
    admin
      .from('yumiwpp_mensagens')
      .select('autor, texto')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: false })
      .limit(CONTEXTO_MENSAGENS),
  ])

  const historico: MensagemHistorico[] = (historicoBruto ?? []).slice().reverse()

  const resposta = await gerarResposta({
    systemPrompt: config?.system_prompt ?? '',
    knowledgeBase: config?.knowledge_base ?? '',
    valoresTexto,
    historico,
    modelo: config?.modelo,
  })

  await registrarUso(admin, resposta.uso, {
    conversaId: conversa.id,
    telefone,
    origem: 'atendimento',
  })

  if (resposta.escalar) {
    // Grava a escalada ANTES de mexer no modo da conversa: o trigger
    // yumiwpp_conversas_escalada procura a escalada aberta mais recente
    // pra carimbar assumido_em/finalizado_em depois.
    await admin.from('yumiwpp_escaladas').insert({
      conversa_id: conversa.id,
      telefone,
      motivo: resposta.motivo,
      prioridade: resposta.prioridade,
      resumo: resposta.resumo,
    })

    // assumido_por fica null de proposito: sinaliza "precisando de atendimento"
    // ate algum gerente clicar em "Assumir atendimento" na tela.
    await admin
      .from('yumiwpp_conversas')
      .update({ modo: 'humano', assumido_por: null })
      .eq('id', conversa.id)

    await notificarAtendentes(admin, {
      telefoneCliente: telefone,
      motivo: resposta.motivo,
      prioridade: resposta.prioridade,
      resumo: resposta.resumo,
    })

    const envio = await enviarMensagem(telefone, MENSAGEM_ESCALADA)
    await admin.from('yumiwpp_mensagens').insert({
      conversa_id: conversa.id,
      telefone,
      autor: 'yumi',
      texto: MENSAGEM_ESCALADA,
      zapi_message_id: envio.ok ? envio.messageId : null,
    })

    return NextResponse.json({ ok: true })
  }

  const envio = await enviarMensagem(telefone, resposta.texto)
  await admin.from('yumiwpp_mensagens').insert({
    conversa_id: conversa.id,
    telefone,
    autor: 'yumi',
    texto: resposta.texto,
    zapi_message_id: envio.ok ? envio.messageId : null,
  })

  return NextResponse.json({ ok: true })
}
