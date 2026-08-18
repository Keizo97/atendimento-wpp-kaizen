import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Usuarios from '@/components/admin/Usuarios'
import Atendentes from '@/components/admin/Atendentes'
import PrecosModelo from '@/components/admin/PrecosModelo'
import ModeloIA from '@/components/admin/ModeloIA'
import type { Role } from '@/lib/auth'

const INTEGRACOES = [
  { chave: 'ZAPI_INSTANCE', label: 'Z-API — instância' },
  { chave: 'ZAPI_TOKEN', label: 'Z-API — token' },
  { chave: 'ZAPI_CLIENT_TOKEN', label: 'Z-API — client token' },
  { chave: 'ZAPI_WEBHOOK_SECRET', label: 'Z-API — segredo do webhook' },
  { chave: 'OPENAI_API_KEY', label: 'OpenAI — chave' },
  { chave: 'CRON_SECRET', label: 'Segredo do motor de análise diária' },
  { chave: 'NEXT_PUBLIC_LINK_RESERVA', label: 'Link de reserva' },
  { chave: 'NEXT_PUBLIC_LINK_FILA', label: 'Link de fila' },
] as const

export default async function AdminPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: profiles }, { data: authData }, { data: atendentes }, { data: precos }, { data: config }] =
    await Promise.all([
      supabase.from('yumiwpp_profiles').select('id, nome, role'),
      admin.auth.admin.listUsers(),
      supabase.from('yumiwpp_atendentes').select('id, nome, numero, ativo').order('nome'),
      supabase
        .from('yumiwpp_precos_modelo')
        .select('modelo, usd_entrada_1m, usd_saida_1m')
        .order('modelo'),
      supabase.from('yumiwpp_config').select('modelo, modelo_analise').eq('id', 1).maybeSingle(),
    ])

  const emailPorId = new Map(authData?.users.map((u) => [u.id, u.email ?? '']) ?? [])

  const usuarios = (profiles ?? [])
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      role: p.role as Role,
      email: emailPorId.get(p.id) ?? '',
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-400">
        Usuários e status das integrações. Segredos ficam em variáveis de ambiente, nunca aqui.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold">Usuários</h2>
        <Usuarios usuarios={usuarios} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold">Atendentes (aviso de escalada)</h2>
        <Atendentes atendentes={atendentes ?? []} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold">Modelo da IA</h2>
        <ModeloIA modelo={config?.modelo ?? ''} modeloAnalise={config?.modelo_analise ?? ''} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold">Preço dos modelos (custo no dashboard)</h2>
        <PrecosModelo precos={precos ?? []} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Integrações</h2>
        <div className="flex flex-col gap-1.5">
          {INTEGRACOES.map((item) => {
            const valor = process.env[item.chave]
            const configurado = Boolean(valor && valor.trim())
            return (
              <div
                key={item.chave}
                className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm"
              >
                <span className="text-neutral-300">{item.label}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    configurado
                      ? 'bg-emerald-950/60 text-emerald-300'
                      : 'bg-red-950/60 text-red-300'
                  }`}
                >
                  {configurado ? 'configurado' : 'faltando'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Pra mudar qualquer valor daqui, edita a variável de ambiente (`.env.local` local, ou
          nas configurações do serviço no Render/Coolify) e reinicia o app.
        </p>
      </section>
    </main>
  )
}
