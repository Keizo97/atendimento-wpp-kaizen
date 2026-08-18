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

// Mobile: cada item vira um cartao empilhado (2 colunas de campo).
// A partir de sm (640px): volta pra uma linha compacta, como tabela.
const CAMPO =
  'min-h-11 rounded border border-neutral-800 bg-neutral-900 px-2 text-sm sm:min-h-0 sm:py-1'

function LinhaValor({ valor }: { valor: Valor }) {
  const [pendente, startTransition] = useTransition()
  const salvar = atualizarValor.bind(null, valor.id)

  return (
    <form
      action={(fd) => startTransition(() => salvar(fd))}
      className="mb-2 grid grid-cols-2 gap-2 rounded-lg border border-neutral-900 p-3 sm:mb-0 sm:grid-cols-[1fr_1fr_100px_1fr_auto_auto] sm:items-center sm:rounded-none sm:border-0 sm:border-b sm:p-0 sm:py-2"
    >
      <input name="item" defaultValue={valor.item} className={CAMPO} />
      <input
        name="categoria"
        defaultValue={valor.categoria ?? ''}
        placeholder="categoria"
        className={CAMPO}
      />
      <input name="preco" defaultValue={valor.preco ?? ''} placeholder="R$" className={CAMPO} />
      <input
        name="condicao"
        defaultValue={valor.condicao ?? ''}
        placeholder="condição (ex: almoço seg-sex)"
        className={CAMPO}
      />
      <button
        type="submit"
        disabled={pendente}
        className="min-h-11 rounded border border-neutral-700 px-2 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 sm:min-h-0 sm:py-1"
      >
        Salvar
      </button>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <button
          type="button"
          onClick={() => startTransition(() => alternarAtivoValor(valor.id, !valor.ativo))}
          className={`min-h-11 flex-1 rounded px-2 text-xs sm:min-h-0 sm:flex-none sm:py-1 ${
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
          className="min-h-11 flex-1 rounded px-2 text-xs text-red-400 hover:bg-red-950/40 sm:min-h-0 sm:flex-none sm:py-1"
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
      <p className="mb-3 text-xs text-neutral-500">
        Itens estruturados que entram junto no contexto da Yumi (além do que já está no system
        prompt). Útil pra preço/promoção que muda com frequência.
      </p>

      <div className="hidden grid-cols-[1fr_1fr_100px_1fr_auto_auto] gap-2 pb-1 text-xs text-neutral-500 sm:grid">
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
        className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-dashed border-neutral-800 p-3 sm:grid-cols-[1fr_1fr_100px_1fr_auto] sm:items-center sm:rounded-none sm:border-0 sm:p-0"
      >
        <input name="item" placeholder="novo item" required className={CAMPO} />
        <input name="categoria" placeholder="categoria" className={CAMPO} />
        <input name="preco" placeholder="R$" className={CAMPO} />
        <input name="condicao" placeholder="condição" className={CAMPO} />
        <button
          type="submit"
          disabled={pendente}
          className="col-span-2 min-h-11 rounded bg-neutral-100 px-3 text-xs font-medium text-neutral-900 disabled:opacity-50 sm:col-span-1 sm:min-h-0 sm:py-1.5"
        >
          Adicionar
        </button>
      </form>
    </div>
  )
}
