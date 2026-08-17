'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { estadoConversa, type ConversaRow, type Mensagem, type MensagemRealtime } from './types'

// Rede de seguranca: mesmo que o Realtime falhe, o chat busca mensagem nova
// sozinho dentro desse intervalo.
const INTERVALO_POLLING_MS = 2_500

export default function ConversaChat({
  conversa,
  meuId,
  mensagensNovas,
}: {
  conversa: ConversaRow
  meuId: string
  mensagensNovas: MensagemRealtime[]
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, startEnviar] = useTransition()
  const fimRef = useRef<HTMLDivElement>(null)
  const estado = estadoConversa(conversa)

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
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div>
          <p className="font-medium">
            {conversa.yumiwpp_clientes?.nome || conversa.telefone}
          </p>
          <p className="text-xs text-neutral-500">
            {conversa.telefone}
            {estado === 'aguardando' && (
              <span className="ml-2 rounded bg-amber-950/60 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
                Precisa de atendimento
              </span>
            )}
            {estado === 'em_atendimento' && (
              <span className="ml-2 text-neutral-500">
                · em atendimento por {conversa.atendente?.nome || 'alguém'}
              </span>
            )}
          </p>
        </div>

        {estado === 'bot' && (
          <button
            onClick={assumirConversa}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800"
          >
            Assumir conversa
          </button>
        )}
        {estado === 'aguardando' && (
          <button
            onClick={assumirAtendimento}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-neutral-950 transition hover:bg-amber-400"
          >
            Assumir atendimento
          </button>
        )}
        {estado === 'em_atendimento' && (
          <button
            onClick={finalizarAtendimento}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-white"
          >
            Finalizar atendimento
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={`mb-2 flex ${m.autor === 'cliente' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                m.autor === 'cliente'
                  ? 'bg-neutral-800 text-neutral-100'
                  : m.autor === 'yumi'
                    ? 'bg-emerald-900/60 text-emerald-50'
                    : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              {m.texto}
              <div className="mt-1 text-[10px] opacity-60">
                {m.autor === 'yumi' ? 'Yumi' : m.autor === 'gerente' ? 'Voce' : ''}
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
        className="flex gap-2 border-t border-neutral-800 p-3"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
