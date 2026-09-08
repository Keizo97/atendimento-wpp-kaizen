// Envio de mensagem via Z-API. Mesmo padrao usado no Kaizen-reservas.
import 'server-only'

type EnviarResultado =
  | { ok: true; messageId: string | null }
  | { ok: false; erro: string }

export type OpcoesEnvio = {
  // Segundos que a Z-API mostra "Digitando..." antes de entregar a mensagem.
  // 1-15 (limite da API). Sem isso a resposta cai instantanea, o que e um
  // dos motivos da conversa parecer bot.
  delayTyping?: number
  // Pausa (segundos, 1-15) antes de comecar a enviar. Da API tambem.
  delayMessage?: number
}

export async function enviarMensagem(
  phone: string,
  message: string,
  opcoes?: OpcoesEnvio
): Promise<EnviarResultado> {
  const instance = process.env.ZAPI_INSTANCE
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instance || !token || !clientToken) {
    return { ok: false, erro: 'Z-API nao configurada (faltam variaveis de ambiente)' }
  }

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`

  const clamp = (v: number) => Math.min(15, Math.max(1, Math.round(v)))

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
      body: JSON.stringify({
        phone,
        message,
        ...(opcoes?.delayTyping ? { delayTyping: clamp(opcoes.delayTyping) } : {}),
        ...(opcoes?.delayMessage ? { delayMessage: clamp(opcoes.delayMessage) } : {}),
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return { ok: false, erro: `Z-API respondeu ${res.status}: ${JSON.stringify(data)}` }
    }

    const messageId: string | null =
      data?.messageId ?? data?.zaapId ?? data?.id ?? null

    return { ok: true, messageId }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'erro desconhecido ao chamar Z-API',
    }
  }
}
