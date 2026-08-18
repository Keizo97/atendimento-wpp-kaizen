export default function Cartao({
  titulo,
  valor,
  detalhe,
  destaque,
}: {
  titulo: string
  valor: string
  detalhe?: string
  destaque?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? 'border-emerald-900/60 bg-emerald-950/20' : 'border-neutral-800'
      }`}
    >
      <p className="text-xs text-neutral-500">{titulo}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          destaque ? 'text-emerald-300' : 'text-neutral-100'
        }`}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-neutral-500">{detalhe}</p>}
    </div>
  )
}
