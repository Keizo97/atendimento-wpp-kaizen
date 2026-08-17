// Envio de mensagem via Z-API. Mesmo padrao usado no Kaizen-reservas.
import 'server-only'

type EnviarResultado =
  | { ok: true; messageId: string | null }
  | { ok: false; erro: string }

export async function enviarMensagem(
  phone: string,
  message: string
): Promise<EnviarResultado> {
  const instance = process.env.ZAPI_INSTANCE
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instance || !token || !clientToken) {
    return { ok: false, erro: 'Z-API nao configurada (faltam variaveis de ambiente)' }
  }

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
      body: JSON.stringify({ phone, message }),
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
