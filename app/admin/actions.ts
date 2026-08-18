'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Role } from '@/lib/auth'

export type EstadoConvite = { ok: boolean; erro: string | null; senhaGerada: string | null }

function gerarSenhaTemporaria(): string {
  return randomBytes(9).toString('base64url')
}

export async function convidarUsuario(
  _estado: EstadoConvite,
  formData: FormData
): Promise<EstadoConvite> {
  const email = String(formData.get('email') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const role = String(formData.get('role') ?? 'gerente') as Role

  if (!email || !nome) {
    return { ok: false, erro: 'Preencha nome e e-mail.', senhaGerada: null }
  }

  const senha = gerarSenhaTemporaria()
  const admin = createAdminClient()

  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, role },
  })

  if (error) {
    return { ok: false, erro: error.message, senhaGerada: null }
  }

  revalidatePath('/admin')
  return { ok: true, erro: null, senhaGerada: senha }
}

export async function mudarPapel(userId: string, novoRole: Role) {
  const supabase = await createClient()
  await supabase.from('yumiwpp_profiles').update({ role: novoRole }).eq('id', userId)
  revalidatePath('/admin')
}

export async function criarAtendente(formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  const numero = String(formData.get('numero') ?? '').trim()
  if (!nome || !numero) return

  const supabase = await createClient()
  await supabase.from('yumiwpp_atendentes').insert({ nome, numero })
  revalidatePath('/admin')
}

export async function alternarAtivoAtendente(id: string, ativo: boolean) {
  const supabase = await createClient()
  await supabase.from('yumiwpp_atendentes').update({ ativo }).eq('id', id)
  revalidatePath('/admin')
}

export async function removerAtendente(id: string) {
  const supabase = await createClient()
  await supabase.from('yumiwpp_atendentes').delete().eq('id', id)
  revalidatePath('/admin')
}

export async function salvarPrecoModelo(modelo: string, formData: FormData) {
  const entrada = String(formData.get('usd_entrada_1m') ?? '').replace(',', '.')
  const saida = String(formData.get('usd_saida_1m') ?? '').replace(',', '.')

  const supabase = await createClient()
  await supabase
    .from('yumiwpp_precos_modelo')
    .update({
      usd_entrada_1m: Number(entrada) || 0,
      usd_saida_1m: Number(saida) || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('modelo', modelo)

  revalidatePath('/admin')
  revalidatePath('/dashboard')
}
