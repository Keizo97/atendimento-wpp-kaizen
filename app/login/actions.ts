'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPerfil, rotaInicial } from '@/lib/auth'

export type EstadoLogin = { erro: string | null }

export async function entrar(
  _estado: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')

  if (!email || !senha) {
    return { erro: 'Preencha e-mail e senha.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (error) {
    return { erro: 'E-mail ou senha invalidos.' }
  }

  const perfil = await getPerfil()
  revalidatePath('/', 'layout')
  redirect(perfil ? rotaInicial(perfil.role) : '/')
}

export async function sair() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
