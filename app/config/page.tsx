import { createClient } from '@/lib/supabase/server'
import PromptForm from '@/components/config/PromptForm'
import ValoresManager from '@/components/config/ValoresManager'

export default async function ConfigPage() {
  const supabase = await createClient()

  const [{ data: config }, { data: valores }] = await Promise.all([
    supabase
      .from('yumiwpp_config')
      .select('system_prompt, knowledge_base, updated_at')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('yumiwpp_valores')
      .select('id, item, categoria, preco, condicao, ativo')
      .order('categoria', { ascending: true })
      .order('ordem', { ascending: true }),
  ])

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Configuração da Yumi</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-400">
        Mudanças aqui valem pra próxima mensagem — sem precisar reiniciar nada.
      </p>

      <section className="mb-10">
        <PromptForm
          systemPrompt={config?.system_prompt ?? ''}
          knowledgeBase={config?.knowledge_base ?? ''}
          atualizadoEm={config?.updated_at ?? null}
        />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Valores e itens</h2>
        <ValoresManager valores={valores ?? []} />
      </section>
    </main>
  )
}
