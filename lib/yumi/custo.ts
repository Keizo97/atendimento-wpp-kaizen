// Calcula o custo em USD de uma chamada e grava em yumiwpp_uso_ia.
//
// O preco vem de yumiwpp_precos_modelo (editavel em /admin). O custo e
// calculado AQUI, na hora, e gravado junto com a linha — assim, se o preco
// da OpenAI mudar depois, o historico ja gravado continua correto.
//
// Preco zero (nao configurado) grava custo 0 e o dashboard avisa. Melhor do
// que inventar um numero com cara de certo.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UsoTokens } from './responder'

export async function registrarUso(
  admin: SupabaseClient,
  uso: UsoTokens,
  contexto: {
    conversaId?: string | null
    telefone?: string | null
    origem?: 'atendimento' | 'analise'
  } = {}
) {
  try {
    const { data: preco } = await admin
      .from('yumiwpp_precos_modelo')
      .select('usd_entrada_1m, usd_saida_1m')
      .eq('modelo', uso.modelo)
      .maybeSingle()

    const usdEntrada1m = Number(preco?.usd_entrada_1m ?? 0)
    const usdSaida1m = Number(preco?.usd_saida_1m ?? 0)

    const custo =
      (uso.tokensEntrada / 1_000_000) * usdEntrada1m +
      (uso.tokensSaida / 1_000_000) * usdSaida1m

    await admin.from('yumiwpp_uso_ia').insert({
      conversa_id: contexto.conversaId ?? null,
      telefone: contexto.telefone ?? null,
      origem: contexto.origem ?? 'atendimento',
      modelo: uso.modelo,
      tokens_entrada: uso.tokensEntrada,
      tokens_saida: uso.tokensSaida,
      custo_usd: custo,
    })

    // Modelo novo que ainda nao tem preco cadastrado: cria a linha zerada
    // pra aparecer em /admin e alguem preencher.
    if (!preco) {
      await admin
        .from('yumiwpp_precos_modelo')
        .insert({ modelo: uso.modelo })
        .select()
        .maybeSingle()
    }
  } catch (err) {
    // Registrar custo nunca pode derrubar o atendimento do cliente.
    console.error('[custo] falha ao registrar uso de IA:', err)
  }
}
