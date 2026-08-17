'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConversaChat from './ConversaChat'
import type { ConversaRow, MensagemRealtime } from './types'

// Rede de seguranca: mesmo que o Realtime falhe por algum motivo (rede,
// extensao do navegador, etc.), a lista de conversas se atualiza sozinha
// dentro desse intervalo.
const INTERVALO_POLLING_MS = 5_000

export default function Inbox({
  conversasIniciais,
  meuId,
}: {
  conversasIniciais: ConversaRow[]
  meuId: string
}) {
  const [conversas, setConversas] = useState(conversasIniciais)
  const [selecionadaId, setSelecionadaId] = useState<string | null>(
    conversasIniciais[0]?.id ?? null
  )
  const [mensagensNovas, setMensagensNovas] = useState<MensagemRealtime[]>([])

  const buscarConversas = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('yumiwpp_conversas')
      .select('id, telefone, modo, status, assumido_por, updated_at, yumiwpp_clientes(nome)')
      .eq('status', 'aberta')
      .order('updated_at', { ascending: false })

    if (data) setConversas(data as unknown as ConversaRow[])
  }, [])

  // Rede de seguranca: busca de novo periodicamente, independente do Realtime.
  useEffect(() => {
    const intervalo = setInterval(buscarConversas, INTERVALO_POLLING_MS)
    return () => clearInterval(intervalo)
  }, [buscarConversas])

  useEffect(() => {
    const supabase = createClient()

    const canalConversas = supabase
      .channel(`yumiwpp-conversas-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'yumiwpp_conversas' },
        (payload) => {
          setConversas((atuais) => {
            if (payload.eventType === 'DELETE') {
              const removida = payload.old as { id: string }
              return atuais.filter((c) => c.id !== removida.id)
            }

            const nova = payload.new as Omit<ConversaRow, 'yumiwpp_clientes'>

            if (nova.status !== 'aberta') {
              return atuais.filter((c) => c.id !== nova.id)
            }

            const existe = atuais.find((c) => c.id === nova.id)
            const linha: ConversaRow = {
              ...nova,
              yumiwpp_clientes: existe?.yumiwpp_clientes ?? null,
            }

            const semEla = atuais.filter((c) => c.id !== nova.id)
            return [linha, ...semEla].sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
          })
        }
      )
      .subscribe()

    const canalMensagens = supabase
      .channel(`yumiwpp-mensagens-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'yumiwpp_mensagens' },
        (payload) => {
          setMensagensNovas((atuais) => [...atuais, payload.new as MensagemRealtime])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalConversas)
      supabase.removeChannel(canalMensagens)
    }
  }, [])

  const conversaSelecionada = conversas.find((c) => c.id === selecionadaId) ?? null

  return (
    <div className="flex h-[calc(100dvh-57px)]">
      <aside className="w-full max-w-xs shrink-0 overflow-y-auto border-r border-neutral-800">
        {conversas.length === 0 && (
          <p className="p-4 text-sm text-neutral-500">Nenhuma conversa aberta.</p>
        )}
        {conversas.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelecionadaId(c.id)}
            className={`flex w-full flex-col gap-0.5 border-b border-neutral-900 px-4 py-3 text-left transition hover:bg-neutral-900 ${
              c.id === selecionadaId ? 'bg-neutral-900' : ''
            }`}
          >
            <span className="text-sm font-medium">
              {c.yumiwpp_clientes?.nome || c.telefone}
            </span>
            <span className="flex items-center gap-2 text-xs text-neutral-500">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  c.modo === 'humano' ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              {c.modo === 'humano' ? 'Com humano' : 'Yumi'}
            </span>
          </button>
        ))}
      </aside>

      <section className="flex-1">
        {conversaSelecionada ? (
          <ConversaChat
            key={conversaSelecionada.id}
            conversa={conversaSelecionada}
            meuId={meuId}
            mensagensNovas={mensagensNovas.filter((m) => m.conversa_id === conversaSelecionada.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Selecione uma conversa
          </div>
        )}
      </section>
    </div>
  )
}
