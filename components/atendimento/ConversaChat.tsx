'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConversaRow, Mensagem, MensagemRealtime } from './types'

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
  const modo = conversa.modo

  // Busca inicial: so precisa rodar quando troca de conversa. Atualizacoes ao
  // vivo chegam via mensagensNovas (canal unico e global, aberto no Inbox).
  useEffect(() => {
    const supabase = createClient()
    let ativo = true

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

  async function alternarModo() {
    const supabase = createClient()
    const novoModo = modo === 'humano' ? 'bot' : 'humano'
    await supabase
      .from('yumiwpp_conversas')
      .update({
        modo: novoModo,
        assumido_por: novoModo === 'humano' ? meuId : null,
      })
      .eq('id', conversa.id)
    // Sem setState local: o Inbox ja atua no canal de conversas e propaga
    // o modo novo por prop quando o UPDATE chegar.
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div>
          <p className="font-medium">
            {conversa.yumiwpp_clientes?.nome || conversa.telefone}
          </p>
          <p className="text-xs text-neutral-500">{conversa.telefone}</p>
        </div>
        <button
          onClick={alternarModo}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            modo === 'humano'
              ? 'bg-neutral-100 text-neutral-900 hover:bg-white'
              : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          {modo === 'humano' ? 'Devolver pra Yumi' : 'Assumir conversa'}
        </button>
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
