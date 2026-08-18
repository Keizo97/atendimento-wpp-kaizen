// Metricas do dashboard, calculadas direto do banco (nao passa por IA).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Metricas = {
  conversas: number
  conversasSemHumano: number
  taxaResolucaoSozinha: number | null
  escaladas: number
  motivos: { motivo: string; total: number }[]
  tempoMedioAssumirMin: number | null
  semRespostaCliente: number

  mensagensCliente: number
  mensagensYumi: number
  mensagensGerente: number
  tamanhoMedioRespostaYumi: number | null

  clientesNovos: number
  clientesRecorrentes: number
  linksReservaEnviados: number

  porHora: { hora: number; total: number }[]

  custoTotal: number
  custoPorDia: number | null
  custoPorConversa: number | null
  custoPorConversaSemHumano: number | null
  tokensEntrada: number
  tokensSaida: number
  precoConfigurado: boolean
}

export async function calcularMetricas(
  supabase: SupabaseClient,
  params: { inicio: string; fim: string; dias: number }
): Promise<Metricas> {
  const { inicio, fim, dias } = params

  const [
    { data: mensagens },
    { data: escaladas },
    { data: uso },
    { data: clientes },
    { data: precos },
  ] = await Promise.all([
    supabase
      .from('yumiwpp_mensagens')
      .select('conversa_id, telefone, autor, texto, created_at')
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .order('created_at', { ascending: true }),
    supabase
      .from('yumiwpp_escaladas')
      .select('conversa_id, motivo, created_at, assumido_em')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('yumiwpp_uso_ia')
      .select('tokens_entrada, tokens_saida, custo_usd')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase.from('yumiwpp_clientes').select('telefone, primeiro_contato'),
    supabase.from('yumiwpp_precos_modelo').select('usd_entrada_1m, usd_saida_1m'),
  ])

  const msgs = mensagens ?? []

  // --- conversas ---
  const conversasSet = new Set(msgs.map((m) => m.conversa_id as string))
  const conversas = conversasSet.size

  const conversasEscaladas = new Set((escaladas ?? []).map((e) => e.conversa_id as string))
  const conversasSemHumano = [...conversasSet].filter((id) => !conversasEscaladas.has(id)).length

  // --- ultima mensagem de cada conversa (proxy de "cliente nao respondeu") ---
  const ultimoAutor = new Map<string, string>()
  for (const m of msgs) ultimoAutor.set(m.conversa_id as string, m.autor as string)
  const semRespostaCliente = [...ultimoAutor.values()].filter((a) => a !== 'cliente').length

  // --- escaladas ---
  const contagemMotivos = new Map<string, number>()
  let somaEspera = 0
  let comEspera = 0
  for (const e of escaladas ?? []) {
    contagemMotivos.set(e.motivo as string, (contagemMotivos.get(e.motivo as string) ?? 0) + 1)
    if (e.assumido_em) {
      const min =
        (new Date(e.assumido_em as string).getTime() - new Date(e.created_at as string).getTime()) /
        60000
      if (min >= 0) {
        somaEspera += min
        comEspera++
      }
    }
  }
  const motivos = [...contagemMotivos.entries()]
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total)

  // --- mensagens ---
  const doCliente = msgs.filter((m) => m.autor === 'cliente')
  const daYumi = msgs.filter((m) => m.autor === 'yumi')
  const doGerente = msgs.filter((m) => m.autor === 'gerente')

  const tamanhoMedioRespostaYumi = daYumi.length
    ? Math.round(daYumi.reduce((s, m) => s + String(m.texto).length, 0) / daYumi.length)
    : null

  const linksReservaEnviados = daYumi.filter((m) =>
    String(m.texto).toLowerCase().includes('reservation-widget')
  ).length

  // --- clientes novos x recorrentes (no periodo) ---
  const primeiroContatoPorTelefone = new Map(
    (clientes ?? []).map((c) => [c.telefone as string, c.primeiro_contato as string])
  )
  const telefonesNoPeriodo = new Set(msgs.map((m) => m.telefone as string))
  let clientesNovos = 0
  for (const tel of telefonesNoPeriodo) {
    const primeiro = primeiroContatoPorTelefone.get(tel)
    if (primeiro && primeiro >= inicio && primeiro <= fim) clientesNovos++
  }
  const clientesRecorrentes = telefonesNoPeriodo.size - clientesNovos

  // --- volume por hora (horario de Brasilia) ---
  const contagemHora = new Array(24).fill(0)
  for (const m of doCliente) {
    const hora = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        hour12: false,
      }).format(new Date(m.created_at as string))
    )
    if (!Number.isNaN(hora)) contagemHora[hora]++
  }
  const porHora = contagemHora.map((total, hora) => ({ hora, total }))

  // --- custo ---
  const custoTotal = (uso ?? []).reduce((s, u) => s + Number(u.custo_usd ?? 0), 0)
  const tokensEntrada = (uso ?? []).reduce((s, u) => s + Number(u.tokens_entrada ?? 0), 0)
  const tokensSaida = (uso ?? []).reduce((s, u) => s + Number(u.tokens_saida ?? 0), 0)

  const precoConfigurado = (precos ?? []).some(
    (p) => Number(p.usd_entrada_1m) > 0 || Number(p.usd_saida_1m) > 0
  )

  return {
    conversas,
    conversasSemHumano,
    taxaResolucaoSozinha: conversas ? (conversasSemHumano / conversas) * 100 : null,
    escaladas: (escaladas ?? []).length,
    motivos,
    tempoMedioAssumirMin: comEspera ? Math.round(somaEspera / comEspera) : null,
    semRespostaCliente,

    mensagensCliente: doCliente.length,
    mensagensYumi: daYumi.length,
    mensagensGerente: doGerente.length,
    tamanhoMedioRespostaYumi,

    clientesNovos,
    clientesRecorrentes,
    linksReservaEnviados,

    porHora,

    custoTotal,
    custoPorDia: dias ? custoTotal / dias : null,
    custoPorConversa: conversas ? custoTotal / conversas : null,
    custoPorConversaSemHumano: conversasSemHumano ? custoTotal / conversasSemHumano : null,
    tokensEntrada,
    tokensSaida,
    precoConfigurado,
  }
}
