'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConversaChat from './ConversaChat'
import { estadoConversa, type ConversaRow, type EstadoConversa, type MensagemRealtime } from './types'

// Rede de seguranca: mesmo que o Realtime falhe por algum motivo (rede,
// extensao do navegador, etc.), a lista de conversas se atualiza sozinha
// dentro desse intervalo.
const INTERVALO_POLLING_MS = 5_000

// Prioridade visual: quem precisa de atendimento aparece primeiro sempre,
// nao importa a hora da ultima mensagem.
const PRIORIDADE: Record<EstadoConversa, number> = {
  aguardando: 0,
  em_atendimento: 1,
  bot: 2,
}

function ordenar(lista: ConversaRow[]): ConversaRow[] {
  return [...lista].sort((a, b) => {
    const dif = PRIORIDADE[estadoConversa(a)] - PRIORIDADE[estadoConversa(b)]
    if (dif !== 0) return dif
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

export default function Inbox({
  conversasIniciais,
  meuId,
}: {
  conversasIniciais: ConversaRow[]
  meuId: string
}) {
  const [conversas, setConversas] = useState(() => ordenar(conversasIniciais))
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [mensagensNovas, setMensagensNovas] = useState<MensagemRealtime[]>([])

  const buscarConversas = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('yumiwpp_conversas')
      .select(
        'id, telefone, modo, status, assumido_por, updated_at, yumiwpp_clientes(nome), atendente:yumiwpp_profiles(nome)'
      )
      .eq('status', 'aberta')
      .order('updated_at', { ascending: false })

    if (data) setConversas(ordenar(data as unknown as ConversaRow[]))
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

            const nova = payload.new as Omit<ConversaRow, 'yumiwpp_clientes' | 'atendente'>

            if (nova.status !== 'aberta') {
              return atuais.filter((c) => c.id !== nova.id)
            }

            const existe = atuais.find((c) => c.id === nova.id)
            // Payload do Realtime nao traz o join. Se assumido_por mudou pra
            // alguem novo, o nome so chega no proximo ciclo de polling.
            const atendenteAtual =
              existe?.assumido_por === nova.assumido_por ? existe?.atendente ?? null : null
            const linha: ConversaRow = {
              ...nova,
              yumiwpp_clientes: existe?.yumiwpp_clientes ?? null,
              atendente: atendenteAtual,
            }

            const semEla = atuais.filter((c) => c.id !== nova.id)
            return ordenar([linha, ...semEla])
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
  const aguardando = conversas.filter((c) => estadoConversa(c) === 'aguardando').length

  return (
    <div className="flex h-full">
      {/* Lista: ocupa a tela inteira no celular quando nada esta selecionado;
          vira coluna fixa ao lado do chat a partir do tablet (md). */}
      <aside
        className={`w-full shrink-0 overflow-y-auto border-neutral-800 md:block md:w-80 md:border-r ${
          conversaSelecionada ? 'hidden md:block' : 'block'
        }`}
      >
        {aguardando > 0 && (
          <div className="border-b border-amber-900/40 bg-amber-950/30 px-4 py-2 text-xs font-medium text-amber-400">
            {aguardando} conversa{aguardando > 1 ? 's' : ''} precisando de atendimento
          </div>
        )}

        {conversas.length === 0 && (
          <p className="p-4 text-sm text-neutral-500">Nenhuma conversa aberta.</p>
        )}

        {conversas.map((c) => {
          const estado = estadoConversa(c)
          return (
            <button
              key={c.id}
              onClick={() => setSelecionadaId(c.id)}
              className={`flex min-h-[64px] w-full flex-col justify-center gap-1 border-b border-neutral-900 px-4 py-3 text-left transition hover:bg-neutral-900 ${
                c.id === selecionadaId ? 'bg-neutral-900' : ''
              } ${estado === 'aguardando' ? 'bg-amber-950/20' : ''}`}
            >
              <span className="truncate text-sm font-medium">
                {c.yumiwpp_clientes?.nome || c.telefone}
              </span>
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    estado === 'aguardando'
                      ? 'bg-amber-400'
                      : estado === 'em_atendimento'
                        ? 'bg-blue-400'
                        : 'bg-emerald-400'
                  }`}
                />
                <span className="truncate">
                  {estado === 'aguardando' && (
                    <span className="font-medium text-amber-400">Precisa de atendimento</span>
                  )}
                  {estado === 'em_atendimento' && `Com ${c.atendente?.nome || 'alguém'}`}
                  {estado === 'bot' && 'Yumi'}
                </span>
              </span>
            </button>
          )
        })}
      </aside>

      {/* Chat: some no celular ate uma conversa ser escolhida, some sempre
          visivel a partir do tablet (md). */}
      <section className={`min-w-0 flex-1 ${conversaSelecionada ? 'block' : 'hidden md:block'}`}>
        {conversaSelecionada ? (
          <ConversaChat
            key={conversaSelecionada.id}
            conversa={conversaSelecionada}
            meuId={meuId}
            mensagensNovas={mensagensNovas.filter((m) => m.conversa_id === conversaSelecionada.id)}
            onVoltar={() => setSelecionadaId(null)}
          />
        ) : (
          <div className="hidden h-full items-center justify-center text-sm text-neutral-500 md:flex">
            Selecione uma conversa
          </div>
        )}
      </section>
    </div>
  )
}
