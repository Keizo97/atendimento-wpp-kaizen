'use client'

import { useTransition } from 'react'
import { criarAtendente, alternarAtivoAtendente, removerAtendente } from '@/app/admin/actions'

type Atendente = {
  id: string
  nome: string
  numero: string
  ativo: boolean
}

export default function Atendentes({ atendentes }: { atendentes: Atendente[] }) {
  const [pendente, startTransition] = useTransition()

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-500">
        Quando a Yumi chama um humano, manda WhatsApp pra cada número ativo aqui. Pode ser
        número de pessoa (com DDI+DDD, ex: 5519999999999) ou ID de grupo do Z-API.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
              <th className="pb-2 font-medium">Nome</th>
              <th className="pb-2 font-medium">Número</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {atendentes.map((a) => (
              <tr
                key={a.id}
                className="border-b border-neutral-100 text-neutral-900 dark:border-neutral-900 dark:text-neutral-100"
              >
                <td className="py-2 pr-4">{a.nome}</td>
                <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400">{a.numero}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startTransition(() => alternarAtivoAtendente(a.id, !a.ativo))}
                      className={`min-h-9 cursor-pointer rounded px-2 text-xs ${
                        a.ativo
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-500'
                      }`}
                    >
                      {a.ativo ? 'ativo' : 'inativo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => removerAtendente(a.id))}
                      className="min-h-9 cursor-pointer rounded px-2 text-xs text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={(fd) => startTransition(() => criarAtendente(fd))}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          Nome
          <input
            name="nome"
            required
            placeholder="Keizo"
            className="min-h-11 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 sm:min-h-0 sm:py-1.5 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          Número (ou ID de grupo)
          <input
            name="numero"
            required
            placeholder="5519982246331"
            className="min-h-11 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 sm:min-h-0 sm:py-1.5 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 cursor-pointer rounded bg-emerald-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
        >
          Adicionar
        </button>
      </form>
    </div>
  )
}
