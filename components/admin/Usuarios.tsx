'use client'

import { useActionState, useTransition } from 'react'
import { convidarUsuario, mudarPapel, type EstadoConvite } from '@/app/admin/actions'
import type { Role } from '@/lib/auth'

type UsuarioLinha = {
  id: string
  nome: string
  email: string
  role: Role
}

const estadoInicial: EstadoConvite = { ok: false, erro: null, senhaGerada: null }

function LinhaUsuario({ usuario }: { usuario: UsuarioLinha }) {
  const [, startTransition] = useTransition()

  return (
    <tr className="border-b border-neutral-100 text-neutral-900 dark:border-neutral-900 dark:text-neutral-100">
      <td className="py-2 pr-4">{usuario.nome}</td>
      <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400">{usuario.email}</td>
      <td className="py-2">
        <select
          defaultValue={usuario.role}
          onChange={(e) =>
            startTransition(() => mudarPapel(usuario.id, e.target.value as Role))
          }
          className="min-h-11 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 sm:min-h-0 sm:py-1 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <option value="gerente">gerente</option>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </select>
      </td>
    </tr>
  )
}

export default function Usuarios({ usuarios }: { usuarios: UsuarioLinha[] }) {
  const [estado, formAction, pendente] = useActionState(convidarUsuario, estadoInicial)

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
              <th className="pb-2 font-medium">Nome</th>
              <th className="pb-2 font-medium">E-mail</th>
              <th className="pb-2 font-medium">Papel</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <LinhaUsuario key={u.id} usuario={u} />
            ))}
          </tbody>
        </table>
      </div>

      <form action={formAction} className="mt-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          Nome
          <input
            name="nome"
            required
            className="min-h-11 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 sm:min-h-0 sm:py-1.5 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          E-mail
          <input
            name="email"
            type="email"
            required
            className="min-h-11 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 sm:min-h-0 sm:py-1.5 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          Papel
          <select
            name="role"
            defaultValue="gerente"
            className="min-h-11 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 sm:min-h-0 sm:py-1.5 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="gerente">gerente</option>
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 cursor-pointer rounded bg-emerald-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
        >
          {pendente ? 'Criando...' : 'Criar usuário'}
        </button>
      </form>

      {estado.erro && (
        <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
          {estado.erro}
        </p>
      )}
      {estado.ok && estado.senhaGerada && (
        <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          Usuário criado. Senha temporária (copie e mande pra pessoa, não aparece de novo):{' '}
          <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono dark:bg-black/30">
            {estado.senhaGerada}
          </code>
        </p>
      )}
    </div>
  )
}
