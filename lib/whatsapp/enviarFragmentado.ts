// Quebra a resposta da Yumi em varias mensagens do WhatsApp, com "Digitando..."
// entre elas, em vez de mandar um textao so numa bolha. E o que faz a
// conversa parecer humana de verdade — sem isso, mesmo um texto bem escrito
// denuncia bot na hora (chega tudo de uma vez, sem pausa nenhuma).
import 'server-only'
import { enviarMensagem, type OpcoesEnvio } from './zapi'

export type FragmentoEnviado = {
  texto: string
  envio: Awaited<ReturnType<typeof enviarMensagem>>
}

// A IA nao e confiavel pra controlar quantas linhas em branco ela solta —
// as vezes separa cada linha do bloco de preco, virando 7-8 bolhas picadas
// em vez de conversa (bug visto em teste real). Por isso o teto e BAIXO e
// fixo no codigo, nao depende do modelo se comportar: no maximo 2 bolhas,
// sempre. Se a IA mandar mais paragrafos que isso, tudo que sobrar do 2o
// em diante vira UMA bolha so (paragrafos internos ficam com linha em
// branco dentro da mesma mensagem — isso e normal, gente manda texto
// longo numa mensagem so o tempo todo).
const MAX_FRAGMENTOS = 2

export function dividirEmMensagens(texto: string): string[] {
  const partes = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (partes.length === 0) return [texto.trim()].filter(Boolean)
  if (partes.length <= MAX_FRAGMENTOS) return partes

  // Muitos paragrafos (raro): junta o excedente no ultimo em vez de
  // metralhar 6+ bolhas seguidas, o que ficaria estranho tambem.
  const inicio = partes.slice(0, MAX_FRAGMENTOS - 1)
  const resto = partes.slice(MAX_FRAGMENTOS - 1).join('\n\n')
  return [...inicio, resto]
}

// ~14 caracteres por segundo de "digitacao", entre 1 e 6s. Mensagem curta
// ("Pode sim!") nao trava a conversa; mensagem longa nao passa de 6s pra nao
// deixar o cliente esperando demais.
function delayTypingPara(texto: string): number {
  return Math.min(6, Math.max(1, Math.round(texto.length / 14)))
}

export async function enviarRespostaFragmentada(
  telefone: string,
  texto: string,
  opcoesExtra?: OpcoesEnvio
): Promise<FragmentoEnviado[]> {
  const fragmentos = dividirEmMensagens(texto)
  const resultados: FragmentoEnviado[] = []

  for (const fragmento of fragmentos) {
    const envio = await enviarMensagem(telefone, fragmento, {
      delayTyping: delayTypingPara(fragmento),
      delayMessage: 1,
      ...opcoesExtra,
    })
    resultados.push({ texto: fragmento, envio })
  }

  return resultados
}
