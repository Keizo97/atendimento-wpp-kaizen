// Monta o texto do cardapio/precos a partir de yumiwpp_valores para entrar no contexto da IA.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buscarValoresTexto(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from('yumiwpp_valores')
    .select('item, categoria, preco, condicao')
    .eq('ativo', true)
    .order('categoria', { ascending: true })
    .order('ordem', { ascending: true })

  if (!data || data.length === 0) return ''

  const linhas = data.map((v) => {
    const preco = v.preco != null ? `R$ ${Number(v.preco).toFixed(2)}` : ''
    const condicao = v.condicao ? ` (${v.condicao})` : ''
    const categoria = v.categoria ? `[${v.categoria}] ` : ''
    return `${categoria}${v.item} — ${preco}${condicao}`.trim()
  })

  return `CARDAPIO E VALORES:\n${linhas.join('\n')}`
}
