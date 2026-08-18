// Datas sempre em horario de Brasilia. O banco guarda em UTC, entao "o dia
// de ontem" precisa ser calculado com fuso explicito — senao, rodando as 8h
// BRT (11h UTC), um calculo ingenuo pegaria o dia errado.
const FUSO = 'America/Sao_Paulo'

// Deslocamento do fuso em ms, num instante especifico (cobre horario de verao).
function offsetMs(instante: Date): number {
  const utc = new Date(instante.toLocaleString('en-US', { timeZone: 'UTC' }))
  const local = new Date(instante.toLocaleString('en-US', { timeZone: FUSO }))
  return utc.getTime() - local.getTime()
}

// "2026-08-17" no fuso de Brasilia
export function diaBrasilia(instante = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante)
}

// Range UTC que cobre um dia inteiro (00:00:00 a 23:59:59.999) de Brasilia.
export function rangeDoDia(dia: string): { inicio: string; fim: string } {
  const meioDia = new Date(`${dia}T12:00:00Z`)
  const off = offsetMs(meioDia)

  const inicio = new Date(new Date(`${dia}T00:00:00Z`).getTime() + off)
  const fim = new Date(new Date(`${dia}T23:59:59.999Z`).getTime() + off)

  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

// Range UTC dos ultimos N dias cheios ate o fim de `diaFinal` (inclusive).
export function rangeDeDias(diaFinal: string, dias: number): { inicio: string; fim: string } {
  const { fim } = rangeDoDia(diaFinal)
  const primeiroDia = new Date(`${diaFinal}T12:00:00Z`)
  primeiroDia.setUTCDate(primeiroDia.getUTCDate() - (dias - 1))
  const { inicio } = rangeDoDia(diaBrasilia(primeiroDia))
  return { inicio, fim }
}

// Ontem, em Brasilia. E o dia que o cron das 8h analisa (dia ja fechado).
export function ontemBrasilia(): string {
  const agora = new Date()
  agora.setUTCDate(agora.getUTCDate() - 1)
  return diaBrasilia(agora)
}
