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

// A Yumi separa ideias diferentes com linha em branco (instruido no prompt).
// Quebra simples (\n) continua dentro da mesma bolha — e so pra juntar frase
// curta relacionada, tipo lista de precos de um mesmo festival.
const MAX_FRAGMENTOS = 4

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
