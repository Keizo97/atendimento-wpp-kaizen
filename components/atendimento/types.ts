export type ConversaRow = {
  id: string
  telefone: string
  modo: 'bot' | 'humano'
  status: string
  assumido_por: string | null
  updated_at: string
  yumiwpp_clientes: { nome: string | null } | null
}

export type Mensagem = {
  id: string
  autor: 'cliente' | 'yumi' | 'gerente'
  texto: string
  created_at: string
}

export type MensagemRealtime = Mensagem & { conversa_id: string }
