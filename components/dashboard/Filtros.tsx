'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

const PERIODOS = [
  { dias: 1, label: '1 dia' },
  { dias: 7, label: '7 dias' },
  { dias: 20, label: '20 dias' },
  { dias: 30, label: '30 dias' },
]

export default function Filtros({ diasAtual }: { diasAtual: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pendente, startTransition] = useTransition()

  function trocar(dias: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('dias', String(dias))
    startTransition(() => router.push(`/dashboard?${params.toString()}`))
  }

  return (
    <div className={`flex gap-1 ${pendente ? 'opacity-60' : ''}`}>
      {PERIODOS.map((p) => (
        <button
          key={p.dias}
          onClick={() => trocar(p.dias)}
          className={`min-h-11 rounded-lg px-3 text-sm font-medium transition ${
            p.dias === diasAtual
              ? 'bg-neutral-100 text-neutral-900'
              : 'border border-neutral-800 text-neutral-300 hover:bg-neutral-900'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
