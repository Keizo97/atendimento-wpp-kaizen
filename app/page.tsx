import { redirect } from 'next/navigation'
import { getPerfil, rotaInicial } from '@/lib/auth'

// Raiz nao mostra nada: joga cada papel na tela certa.
export default async function Home() {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  redirect(rotaInicial(perfil.role))
}
