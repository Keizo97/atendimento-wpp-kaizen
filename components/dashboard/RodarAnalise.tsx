'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RodarAnalise({ dia, dias }: { dia: string; dias: number }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'parado' | 'rodando' | 'erro'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  async function rodar() {
    setEstado('rodando')
    setErro(null)
    try {
      const res = await fetch(`/api/cron/analise?dia=${dia}&dias=${dias}`, { method: 'POST' })
      const dados = await res.json()
      if (!res.ok || dados.ok === false) {
        setEstado('erro')
        setErro(dados.motivo || dados.erro || 'falhou')
        return
      }
      setEstado('parado')
      router.refresh()
    } catch (e) {
      setEstado('erro')
      setErro(e instanceof Error ? e.message : 'falhou')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={rodar}
        disabled={estado === 'rodando'}
        className="min-h-11 rounded-lg border border-neutral-700 px-3 text-sm font-medium text-neutral-300 transition hover:bg-neutral-900 disabled:opacity-50"
      >
        {estado === 'rodando' ? 'Analisando...' : 'Rodar análise agora'}
      </button>
      {erro && <span className="text-xs text-red-400">{erro}</span>}
    </div>
  )
}
