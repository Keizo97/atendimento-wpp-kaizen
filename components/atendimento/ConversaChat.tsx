'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from './Avatar'
import { estadoConversa, type ConversaRow, type Mensagem, type MensagemRealtime } from './types'

// Rede de seguranca: mesmo que o Realtime falhe, o chat busca mensagem nova
// sozinho dentro desse intervalo.
const INTERVALO_POLLING_MS = 2_500

function horaMensagem(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ConversaChat({
  conversa,
  meuId,
  mensagensNovas,
  onVoltar,
}: {
  conversa: ConversaRow
  meuId: string
  mensagensNovas: MensagemRealtime[]
  onVoltar: () => void
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, startEnviar] = useTransition()
  const fimRef = useRef<HTMLDivElement>(null)
  const estado = estadoConversa(conversa)
  const nomeExibido = conversa.yumiwpp_clientes?.nome || conversa.telefone

  const buscarMensagens = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('yumiwpp_mensagens')
      .select('id, autor, texto, created_at')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: true })
      .limit(200)

    if (!data) return

    setMensagens((atuais) => {
      const idsExistentes = new Set(atuais.map((m) => m.id))
      const novas = (data as Mensagem[]).filter((m) => !idsExistentes.has(m.id))
      return novas.length > 0 ? [...atuais, ...novas] : atuais
    })
  }, [conversa.id])

  // Busca inicial ao trocar de conversa (substitui a lista toda).
  useEffect(() => {
    let ativo = true
    const supabase = createClient()

    supabase
      .from('yumiwpp_mensagens')
      .select('id, autor, texto, created_at')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (ativo) setMensagens((data as Mensagem[]) ?? [])
      })

    return () => {
      ativo = false
    }
  }, [conversa.id])

  // Rede de seguranca: busca mensagem nova sozinho, independente do Realtime.
  useEffect(() => {
    const intervalo = setInterval(buscarMensagens, INTERVALO_POLLING_MS)
    return () => clearInterval(intervalo)
  }, [buscarMensagens])

  useEffect(() => {
    if (mensagensNovas.length === 0) return
    setMensagens((atuais) => {
      const idsExistentes = new Set(atuais.map((m) => m.id))
      const novas = mensagensNovas.filter((m) => !idsExistentes.has(m.id))
      return novas.length > 0 ? [...atuais, ...novas] : atuais
    })
  }, [mensagensNovas])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens.length])

  function enviar() {
    const valor = texto.trim()
    if (!valor) return
    setTexto('')

    startEnviar(async () => {
      await fetch('/api/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversaId: conversa.id,
          telefone: conversa.telefone,
          texto: valor,
        }),
      })
    })
  }

  // Sem setState local em nenhuma das tres: o Inbox ja atua no canal de
  // conversas (+ polling) e propaga o estado novo por prop quando chegar.
  async function assumirConversa() {
    const supabase = createClient()
    await supabase
      .from('yumiwpp_conversas')
      .update({ modo: 'humano', assumido_por: meuId })
      .eq('id', conversa.id)
  }

  async function assumirAtendimento() {
    const supabase = createClient()
    await supabase.from('yumiwpp_conversas').update({ assumido_por: meuId }).eq('id', conversa.id)
  }

  async function finalizarAtendimento() {
    const supabase = createClient()
    await supabase
      .from('yumiwpp_conversas')
      .update({ modo: 'bot', assumido_por: null })
      .eq('id', conversa.id)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-2 py-2 sm:px-4 sm:py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <button
          onClick={onVoltar}
          aria-label="Voltar pra lista de conversas"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 md:hidden dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <Avatar nome={nomeExibido} chave={conversa.telefone} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{nomeExibido}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-500">
            <span>{conversa.telefone}</span>
            {estado === 'aguardando' && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                Precisa de atendimento
              </span>
            )}
            {estado === 'em_atendimento' && (
              <span className="text-neutral-500 dark:text-neutral-500">
                em atendimento por {conversa.atendente?.nome || 'alguém'}
              </span>
            )}
          </p>
        </div>

        {estado === 'bot' && (
          <button
            onClick={assumirConversa}
            className="min-h-11 shrink-0 cursor-pointer rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Assumir conversa
          </button>
        )}
        {estado === 'aguardando' && (
          <button
            onClick={assumirAtendimento}
            className="min-h-11 shrink-0 cursor-pointer rounded-lg bg-amber-500 px-3 text-sm font-medium text-neutral-950 transition hover:bg-amber-400"
          >
            Assumir atendimento
          </button>
        )}
        {estado === 'em_atendimento' && (
          <button
            onClick={finalizarAtendimento}
            className="min-h-11 shrink-0 cursor-pointer rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Finalizar atendimento
          </button>
        )}
      </header>

      <div className="chat-wallpaper flex-1 overflow-y-auto px-3 py-3 sm:px-6">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={`mb-2 flex ${m.autor === 'cliente' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                m.autor === 'cliente'
                  ? 'rounded-tl-sm bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                  : m.autor === 'yumi'
                    ? 'rounded-tr-sm bg-cyan-50 text-cyan-950 dark:bg-cyan-950/50 dark:text-cyan-50'
                    : 'rounded-tr-sm bg-emerald-100 text-emerald-950 dark:bg-emerald-700 dark:text-white'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.texto}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
                {m.autor === 'yumi' && <span>Yumi ·</span>}
                {m.autor === 'gerente' && <span>Você ·</span>}
                <span>{horaMensagem(m.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
        className="flex shrink-0 items-center gap-2 border-t border-neutral-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800 dark:bg-neutral-950"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite uma mensagem"
          // text-base (16px) evita o Safari dar zoom automatico ao focar o campo.
          className="min-h-11 flex-1 rounded-full border border-transparent bg-neutral-100 px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-emerald-500 sm:text-sm dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          aria-label="Enviar mensagem"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-[-1px]">
            <path d="M3.4 20.6l17.45-8.3a.6.6 0 000-1.08L3.4 2.9a.6.6 0 00-.86.66l1.9 7.2 10.8.74-10.8.74-1.9 7.2a.6.6 0 00.86.66z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
