'use client'

import { useEffect, useState } from 'react'

const CHAVE = 'yumi-theme'

export default function ThemeToggle() {
  // null ate montar no client: evita mostrar o icone errado antes de saber
  // qual tema o script em app/layout.tsx ja aplicou na <html>.
  const [escuro, setEscuro] = useState<boolean | null>(null)

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains('dark'))
  }, [])

  function alternar() {
    const novoEscuro = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', novoEscuro)
    localStorage.setItem(CHAVE, novoEscuro ? 'dark' : 'light')
    setEscuro(novoEscuro)
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
    >
      {escuro === null ? (
        <span className="block h-5 w-5" />
      ) : escuro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      )}
    </button>
  )
}
