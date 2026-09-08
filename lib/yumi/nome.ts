// Valida se o nome que veio do WhatsApp (Z-API: senderName/chatName) e
// mesmo um nome de pessoa, antes de deixar a IA chamar o cliente por ele.
// Perfil do WhatsApp pode vir só emoji, numero de telefone, nome de grupo,
// "WhatsApp Business", etc — nesses casos a Yumi NAO deve chamar por nome.
import 'server-only'

const GENERICOS = new Set(['whatsapp', 'whatsapp business', 'usuario', 'user', 'unknown', 'contato'])

export function primeiroNomeValido(nomeBruto?: string | null): string | null {
  if (!nomeBruto) return null

  // Tira emoji (Extended_Pictographic cobre a maioria), seletor de
  // variacao e zero-width joiner, depois colapsa espaco.
  const semEmoji = nomeBruto
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[️‍]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!semEmoji) return null
  if (semEmoji.length > 40) return null
  if (GENERICOS.has(semEmoji.toLowerCase())) return null

  // Tem que sobrar pelo menos uma letra de verdade (unicode) — corta
  // numero de telefone disfarçado de nome, so simbolo, etc.
  if (!/\p{L}/u.test(semEmoji)) return null

  // So o primeiro nome, tom mais informal/humano ("Oi, Ana!" e nao
  // "Oi, Ana Beatriz Souza Comercio Ltda!").
  const primeiro = semEmoji.split(' ')[0]
  if (!primeiro || !/\p{L}/u.test(primeiro)) return null

  return primeiro
}
