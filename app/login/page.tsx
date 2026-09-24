import { redirect } from 'next/navigation'
import { getPerfil, rotaInicial } from '@/lib/auth'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const perfil = await getPerfil()
  if (perfil) redirect(rotaInicial(perfil.role))

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-5 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
          Y
        </span>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Yumi</h1>
        <p className="mt-1 mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          Atendimento Kaizen Japanese Food
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
