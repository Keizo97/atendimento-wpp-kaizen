// Controle de acesso por papel (gerente | editor | admin).
// Segunda camada de seguranca: o RLS do Supabase e a primeira.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'gerente' | 'editor' | 'admin'

export type Perfil = {
  id: string
  nome: string
  role: Role
  email: string
}

// Para onde cada papel vai quando entra no sistema
export function rotaInicial(role: Role): string {
  if (role === 'editor') return '/config'
  return '/atendimento'
}

export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('yumiwpp_profiles')
    .select('id, nome, role')
    .eq('id', user.id)
    .single()

  if (!data) return null

  return {
    id: data.id,
    nome: data.nome,
    role: data.role as Role,
    email: user.email ?? '',
  }
}

// Usar no layout de cada area. Manda pro login se nao logado,
// e pra area certa se o papel nao tem permissao.
export async function exigirPapel(permitidos: Role[]): Promise<Perfil> {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  if (!permitidos.includes(perfil.role)) redirect(rotaInicial(perfil.role))
  return perfil
}
