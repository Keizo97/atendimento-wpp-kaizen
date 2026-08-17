'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type EstadoSalvar = { ok: boolean; erro: string | null }

export async function salvarPrompt(
  _estado: EstadoSalvar,
  formData: FormData
): Promise<EstadoSalvar> {
  const systemPrompt = String(formData.get('system_prompt') ?? '')
  const knowledgeBase = String(formData.get('knowledge_base') ?? '')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('yumiwpp_config')
    .update({
      system_prompt: systemPrompt,
      knowledge_base: knowledgeBase,
      updated_by: user?.id ?? null,
    })
    .eq('id', 1)

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/config')
  return { ok: true, erro: null }
}

export async function criarValor(formData: FormData) {
  const supabase = await createClient()

  const item = String(formData.get('item') ?? '').trim()
  if (!item) return

  const precoRaw = String(formData.get('preco') ?? '').trim()

  await supabase.from('yumiwpp_valores').insert({
    item,
    categoria: String(formData.get('categoria') ?? '').trim() || null,
    preco: precoRaw ? Number(precoRaw.replace(',', '.')) : null,
    condicao: String(formData.get('condicao') ?? '').trim() || null,
  })

  revalidatePath('/config')
}

export async function atualizarValor(id: string, formData: FormData) {
  const supabase = await createClient()

  const precoRaw = String(formData.get('preco') ?? '').trim()

  await supabase
    .from('yumiwpp_valores')
    .update({
      item: String(formData.get('item') ?? '').trim(),
      categoria: String(formData.get('categoria') ?? '').trim() || null,
      preco: precoRaw ? Number(precoRaw.replace(',', '.')) : null,
      condicao: String(formData.get('condicao') ?? '').trim() || null,
    })
    .eq('id', id)

  revalidatePath('/config')
}

export async function alternarAtivoValor(id: string, ativo: boolean) {
  const supabase = await createClient()
  await supabase.from('yumiwpp_valores').update({ ativo }).eq('id', id)
  revalidatePath('/config')
}

export async function removerValor(id: string) {
  const supabase = await createClient()
  await supabase.from('yumiwpp_valores').delete().eq('id', id)
  revalidatePath('/config')
}
