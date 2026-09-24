const CORES = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-lime-600',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
]

// Cor estavel por conversa (baseada no telefone, nao no nome, que pode mudar).
function corPara(chave: string): string {
  let hash = 0
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) >>> 0
  return CORES[hash % CORES.length]
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export default function Avatar({
  nome,
  chave,
  size = 'md',
}: {
  nome: string
  chave: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const tamanho =
    size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm'

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${tamanho} ${corPara(chave)}`}
    >
      {iniciais(nome)}
    </div>
  )
}
