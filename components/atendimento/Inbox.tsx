'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from './Avatar'
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

// Hora quando foi hoje, senao data curta — igual ao que o WhatsApp mostra na lista.
function horaResumo(iso: string): string {
  const data = new Date(iso)
  const hoje = new Date()
  const mesmoDia = data.toDateString() === hoje.toDateString()
  if (mesmoDia) return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
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
  const [busca, setBusca] = useState('')

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

  const conversasFiltradas = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    if (!alvo) return conversas
    return conversas.filter((c) => {
      const nome = (c.yumiwpp_clientes?.nome || '').toLowerCase()
      return nome.includes(alvo) || c.telefone.includes(alvo)
    })
  }, [conversas, busca])

  const conversaSelecionada = conversas.find((c) => c.id === selecionadaId) ?? null
  const aguardando = conversas.filter((c) => estadoConversa(c) === 'aguardando').length

  return (
    <div className="flex h-full">
      {/* Lista: ocupa a tela inteira no celular quando nada esta selecionado;
          vira coluna fixa ao lado do chat a partir do tablet (md). */}
      <aside
        className={`flex w-full shrink-0 flex-col border-neutral-200 bg-white md:block md:w-80 md:border-r dark:border-neutral-800 dark:bg-neutral-950 ${
          conversaSelecionada ? 'hidden md:flex' : 'flex'
        }`}
      >
        {aguardando > 0 && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
            {aguardando} conversa{aguardando > 1 ? 's' : ''} precisando de atendimento
          </div>
        )}

        <div className="shrink-0 border-b border-neutral-200 p-2 dark:border-neutral-900">
          <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 dark:bg-neutral-900">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa"
              // text-base (16px) evita o Safari dar zoom automatico ao focar o campo.
              className="min-h-7 flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-500 sm:text-sm dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversasFiltradas.length === 0 && (
            <p className="p-4 text-sm text-neutral-500">
              {busca ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa aberta.'}
            </p>
          )}

          {conversasFiltradas.map((c) => {
            const estado = estadoConversa(c)
            const nomeExibido = c.yumiwpp_clientes?.nome || c.telefone
            return (
              <button
                key={c.id}
                onClick={() => setSelecionadaId(c.id)}
                className={`flex min-h-[68px] w-full cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2.5 text-left transition hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900 ${
                  c.id === selecionadaId ? 'bg-emerald-50 dark:bg-neutral-900' : ''
                } ${estado === 'aguardando' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
              >
                <Avatar nome={nomeExibido} chave={c.telefone} />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {nomeExibido}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-500 dark:text-neutral-500">
                      {horaResumo(c.updated_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-500">
                    <span
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        estado === 'aguardando'
                          ? 'bg-amber-500'
                          : estado === 'em_atendimento'
                            ? 'bg-blue-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                    <span className="truncate">
                      {estado === 'aguardando' && (
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          Precisa de atendimento
                        </span>
                      )}
                      {estado === 'em_atendimento' && `Com ${c.atendente?.nome || 'alguém'}`}
                      {estado === 'bot' && 'Yumi'}
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
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
          <div className="hidden h-full flex-col items-center justify-center gap-2 text-neutral-400 md:flex dark:text-neutral-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-16 w-16">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.06 0-2.08-.16-3.02-.46L3 21l1.5-4.19C3.55 15.4 3 13.76 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        )}
      </section>
    </div>
  )
}
