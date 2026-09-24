import Link from 'next/link'
import { sair } from '@/app/login/actions'
import ThemeToggle from '@/components/ThemeToggle'
import type { Perfil, Role } from '@/lib/auth'

const LINKS: { href: string; label: string; papeis: Role[] }[] = [
  { href: '/atendimento', label: 'Atendimento', papeis: ['gerente', 'admin'] },
  { href: '/dashboard', label: 'Dashboard', papeis: ['admin'] },
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
    <div className="flex h-dvh flex-col bg-white dark:bg-neutral-950">
      <header className="flex shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-2 py-2 sm:gap-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-950">
        <span className="hidden shrink-0 items-center gap-2 px-2 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            Y
          </span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Yumi</span>
        </span>

        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {visiveis.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={ativo === l.href ? 'page' : undefined}
              className={`flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition ${
                ativo === l.href
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <ThemeToggle />

        <span className="hidden shrink-0 text-sm text-neutral-500 md:inline dark:text-neutral-400">
          {perfil.nome} · {perfil.role}
        </span>

        <form action={sair} className="shrink-0">
          <button
            type="submit"
            className="flex min-h-11 cursor-pointer items-center rounded-lg border border-neutral-200 px-3 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          >
            Sair
          </button>
        </form>
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
