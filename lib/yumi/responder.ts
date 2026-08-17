// Cerebro da Yumi: monta o contexto e chama a OpenAI.
// Escalada pra humano e feita por tool call, nao por palavra-chave no texto,
// pra funcionar mesmo com o system_prompt que o Editor reescrever no /config.
import 'server-only'
import OpenAI from 'openai'

export type AutorMensagem = 'cliente' | 'yumi' | 'gerente'
export type MensagemHistorico = { autor: AutorMensagem; texto: string }

export type RespostaYumi =
  | { escalar: true; motivo: string }
  | { escalar: false; texto: string }

const FERRAMENTA_ESCALAR: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'escalar_atendimento',
    description:
      'Chame esta funcao em vez de responder normalmente quando: o cliente reclamar de algo, pedir explicitamente para falar com uma pessoa/atendente/humano, ou fizer um pedido para 15 pessoas ou mais.',
    parameters: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Resumo curto do motivo da escalada',
        },
      },
      required: ['motivo'],
    },
  },
}

const INSTRUCAO_FIXA =
  '\n\nREGRA FIXA DE ESCALADA: se o cliente reclamar de algo, pedir para falar com atendente, humano ou pessoa, ou fizer pedido para 15 pessoas ou mais, chame a funcao escalar_atendimento em vez de responder normalmente.'

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

export async function gerarResposta(params: {
  systemPrompt: string
  knowledgeBase: string
  valoresTexto: string
  historico: MensagemHistorico[]
}): Promise<RespostaYumi> {
  const systemFinal =
    [params.systemPrompt, params.knowledgeBase, params.valoresTexto]
      .filter(Boolean)
      .join('\n\n') + INSTRUCAO_FIXA

  const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemFinal },
    ...params.historico.map(
      (m): OpenAI.Chat.ChatCompletionMessageParam => ({
        role: m.autor === 'cliente' ? 'user' : 'assistant',
        content: m.texto,
      })
    ),
  ]

  const completion = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    messages: mensagens,
    tools: [FERRAMENTA_ESCALAR],
    tool_choice: 'auto',
  })

  const escolha = completion.choices[0]?.message
  const toolCall = escolha?.tool_calls?.[0]

  if (toolCall && toolCall.type === 'function' && toolCall.function.name === 'escalar_atendimento') {
    let motivo = 'nao informado'
    try {
      const args = JSON.parse(toolCall.function.arguments)
      if (args?.motivo) motivo = String(args.motivo)
    } catch {
      // mantem motivo padrao se o JSON vier malformado
    }
    return { escalar: true, motivo }
  }

  return { escalar: false, texto: escolha?.content?.trim() || 'Desculpa, pode repetir?' }
}
