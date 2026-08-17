export type ConversaRow = {
  id: string
  telefone: string
  modo: 'bot' | 'humano'
  status: string
  assumido_por: string | null
  updated_at: string
  yumiwpp_clientes: { nome: string | null } | null
  atendente: { nome: string | null } | null
}

// Estado derivado de modo + assumido_por, usado pra UI (sidebar e chat).
export type EstadoConversa = 'bot' | 'aguardando' | 'em_atendimento'

export function estadoConversa(c: Pick<ConversaRow, 'modo' | 'assumido_por'>): EstadoConversa {
  if (c.modo === 'bot') return 'bot'
  return c.assumido_por ? 'em_atendimento' : 'aguardando'
}

export type Mensagem = {
  id: string
  autor: 'cliente' | 'yumi' | 'gerente'
  texto: string
  created_at: string
}

export type MensagemRealtime = Mensagem & { conversa_id: string }
