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
          <label htmlFor="system_prompt" className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
          <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{'{{LINK_RESERVA}}'}</code> e{' '}
          <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{'{{LINK_FILA}}'}</code> onde quiser
          que os links reais entrem.
        </p>
        <textarea
          id="system_prompt"
          name="system_prompt"
          defaultValue={systemPrompt}
          rows={22}
          className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      <div>
        <label htmlFor="knowledge_base" className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
          className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {estado.erro && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          Salvo. A Yumi já usa essa versão na próxima mensagem.
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="self-start cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendente ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
