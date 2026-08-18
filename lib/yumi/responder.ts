// Cerebro da Yumi: monta o contexto e chama a OpenAI.
// Escalada pra humano e feita por tool call, nao por palavra-chave no texto,
// pra funcionar mesmo com o system_prompt que o Editor reescrever no /config.
//
// Nome da tool e formato dos parametros seguem exatamente o que o
// "Prompt para yumi.txt" instrui (tool `escalar_humano`, motivo/prioridade/
// resumo) — mudar aqui sem mudar o prompt (ou vice-versa) quebra o
// function calling.
import 'server-only'
import OpenAI from 'openai'

export type AutorMensagem = 'cliente' | 'yumi' | 'gerente'
export type MensagemHistorico = { autor: AutorMensagem; texto: string }

export type Escalada = {
  motivo: string
  prioridade: 'normal' | 'urgente'
  resumo: string
}

// Tokens gastos na chamada. Vai pro yumiwpp_uso_ia pra alimentar o dashboard
// de custo — sem isso nao existe historico de gasto.
export type UsoTokens = {
  modelo: string
  tokensEntrada: number
  tokensSaida: number
}

export type RespostaYumi = { uso: UsoTokens } & (
  | ({ escalar: true } & Escalada)
  | { escalar: false; texto: string }
)

const FERRAMENTA_ESCALAR: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'escalar_humano',
    description:
      'Chame esta funcao em vez de responder normalmente quando o cliente pedir atendimento humano, fizer uma reclamacao, pedir alteracao/cancelamento de reserva, ou o evento for de 15 pessoas ou mais.',
    parameters: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          enum: ['atendimento_humano', 'reclamacao', 'evento_grande', 'alteracao_de_reserva'],
          description: 'Categoria da escalada',
        },
        prioridade: {
          type: 'string',
          enum: ['normal', 'urgente'],
          description: 'Urgencia do caso',
        },
        resumo: {
          type: 'string',
          description: 'Resumo curto do caso para a equipe entender rapido',
        },
      },
      required: ['motivo', 'prioridade', 'resumo'],
    },
  },
}

const INSTRUCAO_FIXA =
  '\n\nREGRA FIXA DE ESCALADA: siga a secao "QUANDO CHAMAR UM HUMANO" acima e chame a funcao escalar_humano (nunca resolva sozinha) quando o cliente pedir atendimento humano, reclamar, pedir alteracao/cancelamento de reserva, ou o evento for de 15 pessoas ou mais.'

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

// Troca {{LINK_RESERVA}} e {{LINK_FILA}} pelos links reais configurados no .env.
function resolverPlaceholders(texto: string): string {
  return texto
    .replaceAll('{{LINK_RESERVA}}', process.env.NEXT_PUBLIC_LINK_RESERVA ?? '')
    .replaceAll('{{LINK_FILA}}', process.env.NEXT_PUBLIC_LINK_FILA ?? '')
}

export async function gerarResposta(params: {
  systemPrompt: string
  knowledgeBase: string
  valoresTexto: string
  historico: MensagemHistorico[]
}): Promise<RespostaYumi> {
  const systemFinal =
    resolverPlaceholders(
      [params.systemPrompt, params.knowledgeBase, params.valoresTexto].filter(Boolean).join('\n\n')
    ) + INSTRUCAO_FIXA

  const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemFinal },
    ...params.historico.map(
      (m): OpenAI.Chat.ChatCompletionMessageParam => ({
        role: m.autor === 'cliente' ? 'user' : 'assistant',
        content: m.texto,
      })
    ),
  ]

  const modelo = process.env.OPENAI_MODEL || 'gpt-5-mini'

  const completion = await getClient().chat.completions.create({
    model: modelo,
    messages: mensagens,
    tools: [FERRAMENTA_ESCALAR],
    tool_choice: 'auto',
  })

  const uso: UsoTokens = {
    modelo,
    tokensEntrada: completion.usage?.prompt_tokens ?? 0,
    tokensSaida: completion.usage?.completion_tokens ?? 0,
  }

  const escolha = completion.choices[0]?.message
  const toolCall = escolha?.tool_calls?.[0]

  if (toolCall && toolCall.type === 'function' && toolCall.function.name === 'escalar_humano') {
    let dados: Partial<Escalada> = {}
    try {
      dados = JSON.parse(toolCall.function.arguments)
    } catch {
      // segue com valores padrao se o JSON vier malformado
    }
    return {
      uso,
      escalar: true,
      motivo: dados.motivo ?? 'nao_informado',
      prioridade: dados.prioridade === 'urgente' ? 'urgente' : 'normal',
      resumo: dados.resumo ?? '',
    }
  }

  return { uso, escalar: false, texto: escolha?.content?.trim() || 'Desculpa, pode repetir?' }
}
