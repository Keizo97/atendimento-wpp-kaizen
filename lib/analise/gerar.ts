// Motor de analise: le as conversas do periodo, manda pra OpenAI e grava o
// resultado estruturado em yumiwpp_analises.
import 'server-only'
import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarUso } from '@/lib/yumi/custo'
import { rangeDoDia, rangeDeDias } from './periodo'

// Teto de seguranca: analise de 30 dias num restaurante movimentado pode
// passar do limite de contexto do modelo. Corta as conversas mais antigas.
const MAX_CONVERSAS = 120
const MAX_MENSAGENS_POR_CONVERSA = 40

export type DadosAnalise = {
  assuntos: { tema: string; mencoes: number }[]
  gargalos: { problema: string; impacto: string; frequencia: number }[]
  acertos: string[]
  erros: { descricao: string; exemplo: string }[]
  nao_soube_responder: string[]
  sugestoes: { mudanca: string; motivo: string; prioridade: 'alta' | 'media' | 'baixa' }[]
}

const ESTRUTURA_VAZIA: DadosAnalise = {
  assuntos: [],
  gargalos: [],
  acertos: [],
  erros: [],
  nao_soube_responder: [],
  sugestoes: [],
}

const INSTRUCOES = `Você analisa conversas de WhatsApp entre a Yumi (atendente virtual de um restaurante japonês) e clientes reais.

Seu trabalho é encontrar o que melhorar no atendimento, não elogiar. Seja específico e prático: quem lê isso vai ajustar o prompt da Yumi ou a operação do restaurante no dia seguinte.

Responda SOMENTE com um JSON válido nesse formato:
{
  "resumo": "2 a 4 frases sobre como foi o período, em português",
  "assuntos": [{"tema": "assunto perguntado", "mencoes": 5}],
  "gargalos": [{"problema": "o que travou o atendimento", "impacto": "consequência pro cliente ou pro restaurante", "frequencia": 3}],
  "acertos": ["o que a Yumi fez bem e deve continuar"],
  "erros": [{"descricao": "erro que a Yumi cometeu", "exemplo": "trecho real da conversa"}],
  "nao_soube_responder": ["pergunta que ela não conseguiu responder direito"],
  "sugestoes": [{"mudanca": "ajuste concreto no prompt ou na operação", "motivo": "por que", "prioridade": "alta"}]
}

Regras:
- Ordene "assuntos" e "gargalos" do mais frequente pro menos.
- Em "erros", use trechos reais das conversas como exemplo.
- Em "sugestoes", escreva mudanças acionáveis ("adicionar X na base de conhecimento", "mudar a regra Y"), nunca vagas ("melhorar o atendimento").
- prioridade só pode ser "alta", "media" ou "baixa".
- Se não houver dado suficiente pra alguma seção, devolva lista vazia. Não invente.`

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

type ConversaComMensagens = {
  telefone: string
  mensagens: { autor: string; texto: string }[]
}

async function montarTranscricao(
  admin: SupabaseClient,
  inicio: string,
  fim: string
): Promise<{ texto: string; totalConversas: number }> {
  const { data: mensagens } = await admin
    .from('yumiwpp_mensagens')
    .select('conversa_id, telefone, autor, texto, created_at')
    .gte('created_at', inicio)
    .lte('created_at', fim)
    .order('created_at', { ascending: true })

  if (!mensagens || mensagens.length === 0) {
    return { texto: '', totalConversas: 0 }
  }

  const porConversa = new Map<string, ConversaComMensagens>()
  for (const m of mensagens) {
    const chave = m.conversa_id as string
    if (!porConversa.has(chave)) {
      porConversa.set(chave, { telefone: m.telefone, mensagens: [] })
    }
    porConversa.get(chave)!.mensagens.push({ autor: m.autor, texto: m.texto })
  }

  const conversas = [...porConversa.values()].slice(-MAX_CONVERSAS)

  const texto = conversas
    .map((c, i) => {
      const linhas = c.mensagens
        .slice(-MAX_MENSAGENS_POR_CONVERSA)
        .map((m) => `${m.autor}: ${m.texto}`)
        .join('\n')
      return `--- Conversa ${i + 1} ---\n${linhas}`
    })
    .join('\n\n')

  return { texto, totalConversas: porConversa.size }
}

export async function gerarAnalise(
  admin: SupabaseClient,
  params: { dia: string; periodoDias: number }
): Promise<{ ok: boolean; motivo?: string; totalConversas: number }> {
  const { inicio, fim } =
    params.periodoDias === 1 ? rangeDoDia(params.dia) : rangeDeDias(params.dia, params.periodoDias)

  const { texto, totalConversas } = await montarTranscricao(admin, inicio, fim)

  if (!texto) {
    // Dia sem movimento: grava analise vazia pra tela nao ficar em branco
    // sem explicacao, e pra nao tentar analisar de novo toda hora.
    await admin.from('yumiwpp_analises').upsert(
      {
        data_referencia: params.dia,
        periodo_dias: params.periodoDias,
        resumo: 'Nenhuma conversa nesse período.',
        dados: ESTRUTURA_VAZIA,
      },
      { onConflict: 'data_referencia,periodo_dias' }
    )
    return { ok: true, motivo: 'sem conversas', totalConversas: 0 }
  }

  const modelo = process.env.OPENAI_MODEL_ANALISE || process.env.OPENAI_MODEL || 'gpt-5-mini'

  const completion = await getClient().chat.completions.create({
    model: modelo,
    messages: [
      { role: 'system', content: INSTRUCOES },
      {
        role: 'user',
        content: `Período analisado: ${params.periodoDias} dia(s), até ${params.dia}.\nTotal de conversas: ${totalConversas}.\n\n${texto}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  await registrarUso(
    admin,
    {
      modelo,
      tokensEntrada: completion.usage?.prompt_tokens ?? 0,
      tokensSaida: completion.usage?.completion_tokens ?? 0,
    },
    { origem: 'analise' }
  )

  const bruto = completion.choices[0]?.message?.content ?? '{}'

  let parsed: Partial<DadosAnalise> & { resumo?: string }
  try {
    parsed = JSON.parse(bruto)
  } catch {
    return { ok: false, motivo: 'resposta da IA nao veio em JSON valido', totalConversas }
  }

  const dados: DadosAnalise = {
    assuntos: parsed.assuntos ?? [],
    gargalos: parsed.gargalos ?? [],
    acertos: parsed.acertos ?? [],
    erros: parsed.erros ?? [],
    nao_soube_responder: parsed.nao_soube_responder ?? [],
    sugestoes: parsed.sugestoes ?? [],
  }

  const { error } = await admin.from('yumiwpp_analises').upsert(
    {
      data_referencia: params.dia,
      periodo_dias: params.periodoDias,
      resumo: parsed.resumo ?? null,
      dados,
    },
    { onConflict: 'data_referencia,periodo_dias' }
  )

  if (error) return { ok: false, motivo: error.message, totalConversas }

  return { ok: true, totalConversas }
}
