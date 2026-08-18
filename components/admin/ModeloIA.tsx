'use client'

import { useState, useTransition } from 'react'
import { salvarModeloIA } from '@/app/admin/actions'

// Lista curada, mas o campo aceita qualquer nome digitado — a OpenAI lança
// modelo novo com frequencia e essa lista fica desatualizada rapido.
const MODELOS_CONHECIDOS = [
  'gpt-5-mini',
  'gpt-5',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
]

function SeletorModelo({
  name,
  label,
  ajuda,
  valorInicial,
}: {
  name: string
  label: string
  ajuda: string
  valorInicial: string
}) {
  const conhecido = MODELOS_CONHECIDOS.includes(valorInicial)
  const [outro, setOutro] = useState(!conhecido && valorInicial !== '')
  const [select, setSelect] = useState(conhecido ? valorInicial : 'outro')

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-400">{label}</label>
      <select
        value={outro ? 'outro' : select}
        onChange={(e) => {
          const v = e.target.value
          setSelect(v)
          setOutro(v === 'outro')
        }}
        className="min-h-11 rounded border border-neutral-800 bg-neutral-900 px-2 text-sm text-neutral-100 sm:min-h-0 sm:py-1.5"
      >
        <option value="">(usa a variável de ambiente do servidor)</option>
        {MODELOS_CONHECIDOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value="outro">Outro (digitar)</option>
      </select>

      {outro ? (
        <input
          name={name}
          defaultValue={conhecido ? '' : valorInicial}
          placeholder="nome exato do modelo"
          className="min-h-11 rounded border border-neutral-800 bg-neutral-900 px-2 text-sm text-neutral-100 sm:min-h-0 sm:py-1.5"
        />
      ) : (
        <input type="hidden" name={name} value={select === 'outro' ? '' : select} />
      )}

      <p className="text-xs text-neutral-500">{ajuda}</p>
    </div>
  )
}

export default function ModeloIA({
  modelo,
  modeloAnalise,
}: {
  modelo: string
  modeloAnalise: string
}) {
  const [pendente, startTransition] = useTransition()
  const [salvo, setSalvo] = useState(false)

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await salvarModeloIA(fd)
          setSalvo(true)
        })
      }
      className="flex flex-col gap-4"
    >
      <p className="text-xs text-neutral-500">
        Troca o modelo sem precisar redeploy. Deixando em branco, continua usando o que está
        configurado na variável de ambiente do servidor (`OPENAI_MODEL`).
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <SeletorModelo
          name="modelo"
          label="Modelo da Yumi (responde o cliente)"
          ajuda="Afeta qualidade da resposta e custo por conversa."
          valorInicial={modelo}
        />
        <SeletorModelo
          name="modelo_analise"
          label="Modelo da análise diária"
          ajuda="Só usado uma vez por dia — pode ser um modelo mais robusto sem pesar no custo."
          valorInicial={modeloAnalise}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          onClick={() => setSalvo(false)}
          className="min-h-11 self-start rounded-lg bg-neutral-100 px-4 text-sm font-medium text-neutral-900 disabled:opacity-50 sm:min-h-0 sm:py-2"
        >
          {pendente ? 'Salvando...' : 'Salvar'}
        </button>
        {salvo && !pendente && (
          <span className="text-sm text-emerald-400">
            Salvo — já vale na próxima mensagem/análise.
          </span>
        )}
      </div>
    </form>
  )
}
