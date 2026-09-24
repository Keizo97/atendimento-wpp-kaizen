'use client'

import { useActionState } from 'react'
import { entrar, type EstadoLogin } from './actions'

const estadoInicial: EstadoLogin = { erro: null }

export default function LoginForm() {
  const [estado, formAction, pendente] = useActionState(entrar, estadoInicial)

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">Senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-emerald-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      {estado.erro && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-2 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendente ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
