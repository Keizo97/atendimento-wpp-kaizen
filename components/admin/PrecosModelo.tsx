'use client'

import { useTransition } from 'react'
import { salvarPrecoModelo } from '@/app/admin/actions'

type Preco = {
  modelo: string
  usd_entrada_1m: number
  usd_saida_1m: number
}

function LinhaPreco({ preco }: { preco: Preco }) {
  const [pendente, startTransition] = useTransition()
  const salvar = salvarPrecoModelo.bind(null, preco.modelo)
  const configurado = Number(preco.usd_entrada_1m) > 0 || Number(preco.usd_saida_1m) > 0

  return (
    <form
      action={(fd) => startTransition(() => salvar(fd))}
      className="grid grid-cols-2 items-end gap-2 border-b border-neutral-900 py-3 sm:grid-cols-[1fr_140px_140px_auto]"
    >
      <div className="col-span-2 sm:col-span-1">
        <p className="text-sm font-medium">{preco.modelo}</p>
        {!configurado && <p className="text-xs text-amber-400">preço não configurado</p>}
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        USD / 1M entrada
        <input
          name="usd_entrada_1m"
          defaultValue={preco.usd_entrada_1m}
          inputMode="decimal"
          className="min-h-11 rounded border border-neutral-800 bg-neutral-900 px-2 text-sm text-neutral-100 sm:min-h-0 sm:py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        USD / 1M saída
        <input
          name="usd_saida_1m"
          defaultValue={preco.usd_saida_1m}
          inputMode="decimal"
          className="min-h-11 rounded border border-neutral-800 bg-neutral-900 px-2 text-sm text-neutral-100 sm:min-h-0 sm:py-1.5"
        />
      </label>

      <button
        type="submit"
        disabled={pendente}
        className="col-span-2 min-h-11 rounded border border-neutral-700 px-3 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 sm:col-span-1 sm:min-h-0 sm:py-2"
      >
        Salvar
      </button>
    </form>
  )
}

export default function PrecosModelo({ precos }: { precos: Preco[] }) {
  return (
    <div>
      <p className="mb-3 text-xs text-neutral-500">
        Preço que a OpenAI cobra por 1 milhão de tokens, usado pra calcular o custo no dashboard.
        Consulte em platform.openai.com/docs/pricing e cadastre aqui. O custo de cada conversa é
        gravado na hora — mudar o valor aqui não altera o histórico já registrado.
      </p>

      {precos.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum modelo registrado ainda. A linha aparece sozinha depois da primeira conversa.
        </p>
      )}

      {precos.map((p) => (
        <LinhaPreco key={p.modelo} preco={p} />
      ))}
    </div>
  )
}
