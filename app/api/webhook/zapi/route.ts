// Entrada do WhatsApp. Publica, mas validada por ?secret= na URL do webhook.
// Configurar no painel Z-API: https://SEU_DOMINIO/api/webhook/zapi?secret=ZAPI_WEBHOOK_SECRET
// Ligar tambem o webhook "notifySentByMe" (mesma URL) pra pegar mensagens
// digitadas direto no celular do numero conectado.
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarRespostaFragmentada } from '@/lib/whatsapp/enviarFragmentado'
import { upsertCliente, conversaAberta } from '@/lib/whatsapp/clientes'
import { agendarResposta } from '@/lib/whatsapp/buffer'
import { buscarValoresTexto } from '@/lib/yumi/valores'
import { gerarResposta, type MensagemHistorico } from '@/lib/yumi/responder'
import { registrarUso } from '@/lib/yumi/custo'
import { notificarAtendentes } from '@/lib/whatsapp/notificar'
import { statusFuncionamento } from '@/lib/yumi/horario'
import { primeiroNomeValido } from '@/lib/yumi/nome'

const CONTEXTO_MENSAGENS = Number(process.env.YUMI_CONTEXT_MESSAGES) || 20
const MENSAGEM_ESCALADA = 'Ja estou chamando alguem pra te ajudar, so um instante 🙏'
// Cliente ficou muito tempo sem mandar msg desde que um humano assumiu/respondeu:
// solta a conversa de volta pra Yumi sozinha, sem precisar clicar "Finalizar atendimento".
const MINUTOS_RESET_INATIVIDADE = Number(process.env.YUMI_RESET_INATIVIDADE_MIN) || 30

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

  // Retorno nao usado aqui: o nome salvo e relido em responderCliente() no
  // momento em que o buffer disparar (pode ter mudado durante a espera).
  await upsertCliente(admin, telefone, body.senderName ?? body.chatName ?? null)
  const conversa = await conversaAberta(admin, telefone)

  // Conversa com humano ha muito tempo, mas cliente sumiu sem o gerente clicar
  // "Finalizar atendimento": solta a conversa de volta pra Yumi sozinha.
  // So conta a partir da ULTIMA MSG DO GERENTE — se ainda ta "aguardando"
  // (Yumi escalou mas ninguem assumiu ainda), isso aqui nao mexe.
  if (conversa.modo !== 'bot') {
    const { data: ultimaMsgGerente } = await admin
      .from('yumiwpp_mensagens')
      .select('created_at')
      .eq('conversa_id', conversa.id)
      .eq('autor', 'gerente')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ultimaMsgGerente) {
      const minutosInativo =
        (Date.now() - new Date(ultimaMsgGerente.created_at).getTime()) / 60_000

      if (minutosInativo >= MINUTOS_RESET_INATIVIDADE) {
        await admin
          .from('yumiwpp_conversas')
          .update({ modo: 'bot', assumido_por: null })
          .eq('id', conversa.id)
        conversa.modo = 'bot'
      }
    }
  }

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

  // Nao responde na hora: agenda com debounce (lib/whatsapp/buffer.ts).
  // Se o cliente mandar mais mensagens em sequencia, cada uma reinicia o
  // timer — so gera UMA resposta quando ele parar de digitar, ja com todo
  // o contexto acumulado (a busca do historico acontece so quando o timer
  // disparar, entao pega tudo que foi inserido durante a espera).
  agendarResposta(telefone, () => responderCliente(admin, telefone, conversa.id))

  return NextResponse.json({ ok: true })
}

async function responderCliente(
  admin: SupabaseClient,
  telefone: string,
  conversaId: string
): Promise<void> {
  // Reconfere o estado mais recente: pode ter mudado durante a espera do
  // debounce (ex: gerente assumiu a conversa nesse meio-tempo).
  const { data: conversaAtual } = await admin
    .from('yumiwpp_conversas')
    .select('modo')
    .eq('id', conversaId)
    .maybeSingle()

  if (!conversaAtual || conversaAtual.modo !== 'bot') return

  const [{ data: config }, valoresTexto, { data: historicoBruto }, { data: cliente }] =
    await Promise.all([
      admin
        .from('yumiwpp_config')
        .select('system_prompt, knowledge_base, modelo')
        .eq('id', 1)
        .maybeSingle(),
      buscarValoresTexto(admin),
      admin
        .from('yumiwpp_mensagens')
        .select('autor, texto')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: false })
        .limit(CONTEXTO_MENSAGENS),
      admin.from('yumiwpp_clientes').select('nome').eq('telefone', telefone).maybeSingle(),
    ])

  const historico: MensagemHistorico[] = mesclarLevaAtual(
    (historicoBruto ?? []).slice().reverse()
  )

  const resposta = await gerarResposta({
    systemPrompt: config?.system_prompt ?? '',
    knowledgeBase: config?.knowledge_base ?? '',
    valoresTexto,
    historico,
    modelo: config?.modelo,
    horarioTexto: statusFuncionamento(),
    nomeCliente: primeiroNomeValido(cliente?.nome ?? null),
  })

  await registrarUso(admin, resposta.uso, {
    conversaId,
    telefone,
    origem: 'atendimento',
  })

  if (resposta.escalar) {
    // Grava a escalada ANTES de mexer no modo da conversa: o trigger
    // yumiwpp_conversas_escalada procura a escalada aberta mais recente
    // pra carimbar assumido_em/finalizado_em depois.
    await admin.from('yumiwpp_escaladas').insert({
      conversa_id: conversaId,
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
      .eq('id', conversaId)

    await notificarAtendentes(admin, {
      telefoneCliente: telefone,
      motivo: resposta.motivo,
      prioridade: resposta.prioridade,
      resumo: resposta.resumo,
    })

    const fragmentos = await enviarRespostaFragmentada(telefone, MENSAGEM_ESCALADA)
    for (const { texto: fragmentoTexto, envio } of fragmentos) {
      await admin.from('yumiwpp_mensagens').insert({
        conversa_id: conversaId,
        telefone,
        autor: 'yumi',
        texto: fragmentoTexto,
        zapi_message_id: envio.ok ? envio.messageId : null,
      })
    }

    return
  }

  // Manda em varias bolhas (uma por paragrafo da resposta), com "Digitando..."
  // entre elas, em vez de um textao so — ver lib/whatsapp/enviarFragmentado.ts.
  const fragmentos = await enviarRespostaFragmentada(telefone, resposta.texto)
  for (const { texto: fragmentoTexto, envio } of fragmentos) {
    await admin.from('yumiwpp_mensagens').insert({
      conversa_id: conversaId,
      telefone,
      autor: 'yumi',
      texto: fragmentoTexto,
      zapi_message_id: envio.ok ? envio.messageId : null,
    })
  }
}

// Junta a leva de mensagens do cliente que ainda nao tem resposta (o final
// da conversa, apos a ultima fala da Yumi/gerente) numa UNICA mensagem de
// usuario, unindo o texto com quebra de linha. O resto do historico
// (perguntas antigas ja respondidas) fica intacto, como memoria da
// conversa. Sem isso, cada bolha do buffer vira um turno "user" separado
// no fim do historico e a IA pode se confundir e voltar a responder um
// assunto antigo (ex: preco) em vez do pedido atual (ex: reserva).
function mesclarLevaAtual(historico: MensagemHistorico[]): MensagemHistorico[] {
  let inicioLeva = historico.length
  for (let i = historico.length - 1; i >= 0; i--) {
    if (historico[i].autor !== 'cliente') break
    inicioLeva = i
  }

  // Nao ha leva nova sem resposta (ultima mensagem nao e do cliente, ou
  // historico vazio): nada pra mesclar.
  if (inicioLeva >= historico.length) return historico

  const antes = historico.slice(0, inicioLeva)
  const leva = historico.slice(inicioLeva)

  return [
    ...antes,
    { autor: 'cliente', texto: leva.map((m) => m.texto).join('\n') },
  ]
}
