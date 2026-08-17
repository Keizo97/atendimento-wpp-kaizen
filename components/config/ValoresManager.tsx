'use client'

import { useTransition } from 'react'
import {
  criarValor,
  atualizarValor,
  alternarAtivoValor,
  removerValor,
} from '@/app/config/actions'

type Valor = {
  id: string
  item: string
  categoria: string | null
  preco: number | null
  condicao: string | null
  ativo: boolean
}

function LinhaValor({ valor }: { valor: Valor }) {
  const [pendente, startTransition] = useTransition()
  const salvar = atualizarValor.bind(null, valor.id)

  return (
    <form
      action={(fd) => startTransition(() => salvar(fd))}
      className="grid grid-cols-[1fr_1fr_100px_1fr_auto_auto] items-center gap-2 border-b border-neutral-900 py-2 text-sm"
    >
      <input
        name="item"
        defaultValue={valor.item}
        className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
      />
      <input
        name="categoria"
        defaultValue={valor.categoria ?? ''}
        placeholder="categoria"
        className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
      />
      <input
        name="preco"
        defaultValue={valor.preco ?? ''}
        placeholder="R$"
        className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
      />
      <input
        name="condicao"
        defaultValue={valor.condicao ?? ''}
        placeholder="condição (ex: almoço seg-sex)"
        className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
      />
      <button
        type="submit"
        disabled={pendente}
        className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
      >
        Salvar
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => startTransition(() => alternarAtivoValor(valor.id, !valor.ativo))}
          className={`rounded px-2 py-1 text-xs ${
            valor.ativo
              ? 'bg-emerald-950/60 text-emerald-300'
              : 'bg-neutral-800 text-neutral-500'
          }`}
        >
          {valor.ativo ? 'ativo' : 'inativo'}
        </button>
        <button
          type="button"
          onClick={() => startTransition(() => removerValor(valor.id))}
          className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950/40"
        >
          remover
        </button>
      </div>
    </form>
  )
}

export default function ValoresManager({ valores }: { valores: Valor[] }) {
  const [pendente, startTransition] = useTransition()

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">
        Itens estruturados que entram junto no contexto da Yumi (além do que já está no system
        prompt). Útil pra preço/promoção que muda com frequência.
      </p>

      <div className="grid grid-cols-[1fr_1fr_100px_1fr_auto_auto] gap-2 pb-1 text-xs text-neutral-500">
        <span>Item</span>
        <span>Categoria</span>
        <span>Preço</span>
        <span>Condição</span>
        <span />
        <span />
      </div>

      {valores.map((v) => (
        <LinhaValor key={v.id} valor={v} />
      ))}

      <form
        action={(fd) => startTransition(() => criarValor(fd))}
        className="mt-3 grid grid-cols-[1fr_1fr_100px_1fr_auto] items-center gap-2"
      >
        <input
          name="item"
          placeholder="novo item"
          required
          className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm"
        />
        <input
          name="categoria"
          placeholder="categoria"
          className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm"
        />
        <input
          name="preco"
          placeholder="R$"
          className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm"
        />
        <input
          name="condicao"
          placeholder="condição"
          className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pendente}
          className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>
    </div>
  )
}
