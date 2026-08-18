import Link from 'next/link'
import { sair } from '@/app/login/actions'
import type { Perfil, Role } from '@/lib/auth'

const LINKS: { href: string; label: string; papeis: Role[] }[] = [
  { href: '/atendimento', label: 'Atendimento', papeis: ['gerente', 'admin'] },
  { href: '/config', label: 'Configuração', papeis: ['editor', 'admin'] },
  { href: '/admin', label: 'Admin', papeis: ['admin'] },
]

export default function Shell({
  perfil,
  ativo,
  children,
}: {
  perfil: Perfil
  ativo: string
  children: React.ReactNode
}) {
  const visiveis = LINKS.filter((l) => l.papeis.includes(perfil.role))

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-2 py-2 sm:gap-3 sm:px-4">
        <span className="hidden shrink-0 px-2 font-semibold sm:inline">Yumi</span>

        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {visiveis.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={ativo === l.href ? 'page' : undefined}
              className={`flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition ${
                ativo === l.href
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="hidden shrink-0 text-sm text-neutral-400 md:inline">
          {perfil.nome} · {perfil.role}
        </span>

        <form action={sair} className="shrink-0">
          <button
            type="submit"
            className="flex min-h-11 items-center rounded-lg border border-neutral-800 px-3 text-sm text-neutral-300 transition hover:bg-neutral-900"
          >
            Sair
          </button>
        </form>
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
