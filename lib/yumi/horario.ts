// Calcula se o restaurante esta aberto AGORA (dia da semana + hora, fuso
// de Brasilia), pra injetar como contexto na IA — em vez de virar uma tool
// que a IA precisa lembrar de chamar. Mesma logica do bug de fragmentacao:
// coisa deterministica (dia/hora) fica mais confiavel calculada no codigo
// do que entregue pro modelo decidir ou lembrar de consultar.
//
// NAO leva feriado em conta (nao da pra calcular feriado movel sem uma
// tabela/calendario). Pra feriado a IA usa a secao HORARIOS da base de
// conhecimento, que ja cobre isso em texto.
//
// Fonte dos horarios: "Base de conhecimento yumi.txt", secao HORARIOS.
// Mudou o horario de funcionamento? atualiza os dois lugares.
import 'server-only'

type Periodo = { nome: 'almoço' | 'jantar'; aberturaMin: number; fechamentoMin: number }

const h = (hora: number, min = 0) => hora * 60 + min

const SEG_A_QUI: Periodo[] = [
  { nome: 'almoço', aberturaMin: h(12), fechamentoMin: h(14) },
  { nome: 'jantar', aberturaMin: h(19), fechamentoMin: h(22, 30) },
]
const SEXTA: Periodo[] = [
  { nome: 'almoço', aberturaMin: h(12), fechamentoMin: h(14, 30) },
  { nome: 'jantar', aberturaMin: h(19), fechamentoMin: h(23) },
]
const SABADO: Periodo[] = [
  { nome: 'almoço', aberturaMin: h(12, 30), fechamentoMin: h(15) },
  { nome: 'jantar', aberturaMin: h(19), fechamentoMin: h(23) },
]
const DOMINGO: Periodo[] = [
  { nome: 'almoço', aberturaMin: h(12, 30), fechamentoMin: h(15, 30) },
  // jantar fechado aos domingos
]

const AGENDA: { label: string; periodos: Periodo[] }[] = [
  { label: 'domingo', periodos: DOMINGO },
  { label: 'segunda-feira', periodos: SEG_A_QUI },
  { label: 'terça-feira', periodos: SEG_A_QUI },
  { label: 'quarta-feira', periodos: SEG_A_QUI },
  { label: 'quinta-feira', periodos: SEG_A_QUI },
  { label: 'sexta-feira', periodos: SEXTA },
  { label: 'sábado', periodos: SABADO },
]

function hhmm(min: number): string {
  const horas = Math.floor(min / 60)
  const minutos = min % 60
  return minutos === 0 ? `${horas}h` : `${horas}h${String(minutos).padStart(2, '0')}`
}

// Trick padrao pra ler campos de data num fuso especifico sem depender do
// fuso do servidor: formata em en-US naquele fuso e reconstroi um Date so
// pra ler os campos (nao usar esse Date pra matematica de data real).
function agoraEmSaoPaulo(base: Date): { diaSemana: number; minutosDoDia: number; hora: number; minuto: number } {
  const textoLocal = base.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  const local = new Date(textoLocal)
  return {
    diaSemana: local.getDay(),
    minutosDoDia: local.getHours() * 60 + local.getMinutes(),
    hora: local.getHours(),
    minuto: local.getMinutes(),
  }
}

export function statusFuncionamento(base: Date = new Date()): string {
  const { diaSemana, minutosDoDia, hora, minuto } = agoraEmSaoPaulo(base)
  const hojeInfo = AGENDA[diaSemana]
  const horaFormatada = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`

  const periodoAberto = hojeInfo.periodos.find(
    (p) => minutosDoDia >= p.aberturaMin && minutosDoDia < p.fechamentoMin
  )

  let situacao: string
  if (periodoAberto) {
    situacao = `ABERTO agora (${periodoAberto.nome}, até ${hhmm(periodoAberto.fechamentoMin)})`
  } else {
    const proximoHoje = hojeInfo.periodos.find((p) => minutosDoDia < p.aberturaMin)
    if (proximoHoje) {
      situacao = `FECHADO agora — abre hoje às ${hhmm(proximoHoje.aberturaMin)} (${proximoHoje.nome})`
    } else {
      situacao = 'FECHADO agora'
      for (let i = 1; i <= 7; i++) {
        const proxDiaIndex = (diaSemana + i) % 7
        const proxInfo = AGENDA[proxDiaIndex]
        if (proxInfo.periodos.length > 0) {
          const quando = i === 1 ? 'amanhã' : proxInfo.label
          situacao = `FECHADO agora — abre ${quando} às ${hhmm(proxInfo.periodos[0].aberturaMin)} (${proxInfo.periodos[0].nome})`
          break
        }
      }
    }
  }

  return (
    `HORÁRIO ATUAL (calculado, horário de Brasília): ${hojeInfo.label}, ${horaFormatada}. ${situacao}.\n` +
    `Isso NÃO considera feriado — se hoje for feriado, use a seção HORÁRIOS da base de conhecimento em vez desse calculo.`
  )
}
