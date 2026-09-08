// Manda a resposta da Yumi pro WhatsApp com "Digitando..." antes (Z-API
// delayTyping/delayMessage), em vez de chegar instantanea — isso sozinho
// ja tira boa parte da cara de bot.
//
// Fragmentar em varias bolhas foi tentado e voltou atras (testado em
// producao): a IA nao controla direito quanto de linha em branco solta,
// e o bloco de valores em particular o Keizo confirmou que prefere como
// BLOCÃO UNICO — e como ele mesmo copia e cola quando responde manual.
// Por isso MAX_FRAGMENTOS = 1 por padrao (sem fragmentar). A funcao de
// fragmentar continua aqui, pronta, pra quando fizer sentido em outro
// fluxo (ex: uma etapa de conversa que realmente e "mensagem 1, depois
// mensagem 2") — so subir o numero ali embaixo.
import 'server-only'
import { enviarMensagem, type OpcoesEnvio } from './zapi'

export type FragmentoEnviado = {
  texto: string
  envio: Awaited<ReturnType<typeof enviarMensagem>>
}

const MAX_FRAGMENTOS = Number(process.env.YUMI_MAX_BOLHAS) || 1

export function dividirEmMensagens(texto: string): string[] {
  const limpo = texto.trim()
  if (MAX_FRAGMENTOS <= 1) return limpo ? [limpo] : []

  const partes = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (partes.length === 0) return limpo ? [limpo] : []
  if (partes.length <= MAX_FRAGMENTOS) return partes

  // Mais paragrafos que o teto: junta o excedente no ultimo em vez de
  // metralhar bolha atras de bolha.
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
