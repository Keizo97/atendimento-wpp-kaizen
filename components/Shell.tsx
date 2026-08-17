import Link from 'next/link'
import { sair } from '@/app/login/actions'
import type { Perfil, Role } from '@/lib/auth'

const LINKS: { href: string; label: string; papeis: Role[] }[] = [
  { href: '/atendimento', label: 'Atendimento', papeis: ['gerente', 'admin'] },
  { href: '/config', label: 'Configuracao', papeis: ['editor', 'admin'] },
  { href: '/admin', label: 'Admin', papeis: ['admin'] },
]

export default function Shell({
  perfil,
  children,
}: {
  perfil: Perfil
  children: React.ReactNode
}) {
  const visiveis = LINKS.filter((l) => l.papeis.includes(perfil.role))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-neutral-800 bg-neutral-950/90 px-4 py-3 backdrop-blur">
        <span className="font-semibold">Yumi</span>

        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {visiveis.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-neutral-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="hidden text-sm text-neutral-400 sm:inline">
          {perfil.nome} · {perfil.role}
        </span>

        <form action={sair}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-neutral-800"
          >
            Sair
          </button>
        </form>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  )
}
