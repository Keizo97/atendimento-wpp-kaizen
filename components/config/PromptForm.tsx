'use client'

import { useActionState } from 'react'
import { salvarPrompt, type EstadoSalvar } from '@/app/config/actions'

const estadoInicial: EstadoSalvar = { ok: false, erro: null }

export default function PromptForm({
  systemPrompt,
  knowledgeBase,
  atualizadoEm,
}: {
  systemPrompt: string
  knowledgeBase: string
  atualizadoEm: string | null
}) {
  const [estado, formAction, pendente] = useActionState(salvarPrompt, estadoInicial)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="system_prompt" className="text-sm font-medium text-neutral-200">
            System prompt da Yumi
          </label>
          {atualizadoEm && (
            <span className="text-xs text-neutral-500">
              Atualizado em {new Date(atualizadoEm).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
        <p className="mb-2 text-xs text-neutral-500">
          Persona, regras de escrita, quando escalar pra humano e o cardápio/base de
          conhecimento. Use{' '}
          <code className="rounded bg-neutral-800 px-1">{'{{LINK_RESERVA}}'}</code> e{' '}
          <code className="rounded bg-neutral-800 px-1">{'{{LINK_FILA}}'}</code> onde quiser
          que os links reais entrem.
        </p>
        <textarea
          id="system_prompt"
          name="system_prompt"
          defaultValue={systemPrompt}
          rows={22}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-100 outline-none focus:border-neutral-500"
        />
      </div>

      <div>
        <label htmlFor="knowledge_base" className="mb-1 block text-sm font-medium text-neutral-200">
          Base de conhecimento extra (opcional)
        </label>
        <p className="mb-2 text-xs text-neutral-500">
          Informação adicional que entra junto no contexto da Yumi. Deixe em branco se tudo já
          está no system prompt acima.
        </p>
        <textarea
          id="knowledge_base"
          name="knowledge_base"
          defaultValue={knowledgeBase}
          rows={8}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-100 outline-none focus:border-neutral-500"
        />
      </div>

      {estado.erro && (
        <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{estado.erro}</p>
      )}
      {estado.ok && (
        <p className="rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">
          Salvo. A Yumi já usa essa versão na próxima mensagem.
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="self-start rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
      >
        {pendente ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
