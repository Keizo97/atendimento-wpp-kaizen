import { redirect } from 'next/navigation'
import { getPerfil, rotaInicial } from '@/lib/auth'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const perfil = await getPerfil()
  if (perfil) redirect(rotaInicial(perfil.role))

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Yumi</h1>
        <p className="mt-1 mb-8 text-sm text-neutral-400">
          Atendimento Kaizen Japanese Food
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
