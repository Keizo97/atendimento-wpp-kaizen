import { createClient } from '@/lib/supabase/server'
import { calcularMetricas } from '@/lib/analise/metricas'
import { diaBrasilia, rangeDeDias, rangeDoDia, ontemBrasilia } from '@/lib/analise/periodo'
import type { DadosAnalise } from '@/lib/analise/gerar'
import Filtros from '@/components/dashboard/Filtros'
import Cartao from '@/components/dashboard/Cartao'
import RodarAnalise from '@/components/dashboard/RodarAnalise'

const PERIODOS_VALIDOS = [1, 7, 20, 30]

const ROTULO_MOTIVO: Record<string, string> = {
  atendimento_humano: 'Pediu atendente',
  reclamacao: 'Reclamação',
  evento_grande: 'Evento 15+ pessoas',
  alteracao_de_reserva: 'Alterar/cancelar reserva',
  nao_informado: 'Não informado',
}

function usd(valor: number): string {
  return `US$ ${valor.toFixed(valor < 1 ? 4 : 2)}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  const params = await searchParams
  const diasBruto = Number(params.dias)
  const dias = PERIODOS_VALIDOS.includes(diasBruto) ? diasBruto : 7

  const hoje = diaBrasilia()
  const { inicio, fim } = dias === 1 ? rangeDoDia(hoje) : rangeDeDias(hoje, dias)

  const supabase = await createClient()
  const [metricas, { data: analises }] = await Promise.all([
    calcularMetricas(supabase, { inicio, fim, dias }),
    supabase
      .from('yumiwpp_analises')
      .select('data_referencia, periodo_dias, resumo, dados, created_at')
      .order('data_referencia', { ascending: false })
      .limit(5),
  ])

  const analise = analises?.[0]
  const dados = (analise?.dados ?? null) as DadosAnalise | null
  const picoHora = [...metricas.porHora].sort((a, b) => b.total - a.total)[0]
  const maxHora = Math.max(...metricas.porHora.map((h) => h.total), 1)

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Desempenho da Yumi e custo de operação.
          </p>
        </div>
        <RodarAnalise dia={ontemBrasilia()} dias={1} />
      </div>

      <div className="mb-6">
        <Filtros diasAtual={dias} />
      </div>

      {!metricas.precoConfigurado && (
        <div className="mb-6 rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          Preço do modelo não configurado — os custos aparecem zerados. Cadastre o valor por
          milhão de tokens em <span className="font-medium">Admin → Preço dos modelos</span>.
        </div>
      )}

      {/* Decisao de negocio */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">A Yumi está valendo a pena?</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cartao
            destaque
            titulo="Resolvidas sem humano"
            valor={
              metricas.taxaResolucaoSozinha === null
                ? '—'
                : `${metricas.taxaResolucaoSozinha.toFixed(0)}%`
            }
            detalhe={`${metricas.conversasSemHumano} de ${metricas.conversas} conversas`}
          />
          <Cartao
            titulo="Custo total"
            valor={usd(metricas.custoTotal)}
            detalhe={`${metricas.custoPorDia !== null ? usd(metricas.custoPorDia) : '—'} por dia`}
          />
          <Cartao
            titulo="Custo por conversa"
            valor={metricas.custoPorConversa !== null ? usd(metricas.custoPorConversa) : '—'}
            detalhe={
              metricas.custoPorConversaSemHumano !== null
                ? `${usd(metricas.custoPorConversaSemHumano)} por conversa resolvida sozinha`
                : undefined
            }
          />
          <Cartao
            titulo="Conversas"
            valor={String(metricas.conversas)}
            detalhe={`${metricas.clientesNovos} clientes novos · ${metricas.clientesRecorrentes} recorrentes`}
          />
        </div>
      </section>

      {/* Operacional */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">Operação</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cartao
            titulo="Escaladas pra humano"
            valor={String(metricas.escaladas)}
            detalhe={metricas.motivos[0] ? `maior: ${ROTULO_MOTIVO[metricas.motivos[0].motivo] ?? metricas.motivos[0].motivo}` : undefined}
          />
          <Cartao
            titulo="Tempo até assumir"
            valor={
              metricas.tempoMedioAssumirMin === null
                ? '—'
                : `${metricas.tempoMedioAssumirMin} min`
            }
            detalhe="média da equipe"
          />
          <Cartao
            titulo="Link de reserva enviado"
            valor={String(metricas.linksReservaEnviados)}
            detalhe="vezes que a Yumi mandou o link"
          />
          <Cartao
            titulo="Horário de pico"
            valor={picoHora && picoHora.total > 0 ? `${picoHora.hora}h` : '—'}
            detalhe={picoHora && picoHora.total > 0 ? `${picoHora.total} mensagens` : undefined}
          />
        </div>

        {metricas.motivos.length > 0 && (
          <div className="mt-4 rounded-xl border border-neutral-800 p-4">
            <p className="mb-3 text-xs text-neutral-500">
              Por que caiu pra humano (o que ensinar pra ela)
            </p>
            <div className="flex flex-col gap-2">
              {metricas.motivos.map((m) => (
                <div key={m.motivo} className="flex items-center gap-3 text-sm">
                  <span className="w-48 shrink-0 truncate text-neutral-300">
                    {ROTULO_MOTIVO[m.motivo] ?? m.motivo}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-900">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(m.total / metricas.motivos[0].total) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-neutral-400">{m.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-neutral-800 p-4">
          <p className="mb-3 text-xs text-neutral-500">Mensagens de cliente por hora do dia</p>
          <div className="flex h-24 items-end gap-0.5">
            {metricas.porHora.map((h) => (
              <div
                key={h.hora}
                title={`${h.hora}h — ${h.total} mensagens`}
                className="flex-1 rounded-t bg-neutral-700"
                style={{ height: `${Math.max((h.total / maxHora) * 100, 2)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
            <span>0h</span>
            <span>12h</span>
            <span>23h</span>
          </div>
        </div>
      </section>

      {/* Qualidade */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">Qualidade das respostas</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cartao
            titulo="Tamanho médio da resposta"
            valor={
              metricas.tamanhoMedioRespostaYumi === null
                ? '—'
                : `${metricas.tamanhoMedioRespostaYumi} car.`
            }
            detalhe="acima de ~300 costuma virar textão"
          />
          <Cartao
            titulo="Sem resposta do cliente"
            valor={String(metricas.semRespostaCliente)}
            detalhe="pode ser fim normal ou resposta ruim"
          />
          <Cartao
            titulo="Mensagens da Yumi"
            valor={String(metricas.mensagensYumi)}
            detalhe={`${metricas.mensagensCliente} do cliente · ${metricas.mensagensGerente} da equipe`}
          />
          <Cartao
            titulo="Tokens no período"
            valor={`${((metricas.tokensEntrada + metricas.tokensSaida) / 1000).toFixed(1)}k`}
            detalhe={`${(metricas.tokensEntrada / 1000).toFixed(1)}k entrada · ${(metricas.tokensSaida / 1000).toFixed(1)}k saída`}
          />
        </div>
      </section>

      {/* Analise da IA */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-400">
          Análise automática
          {analise && (
            <span className="ml-2 font-normal text-neutral-600">
              referente a {new Date(`${analise.data_referencia}T12:00:00Z`).toLocaleDateString('pt-BR')}
            </span>
          )}
        </h2>

        {!analise && (
          <div className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-500">
            Nenhuma análise gerada ainda. Ela roda sozinha todo dia às 8h, ou clica em
            &quot;Rodar análise agora&quot; aqui em cima.
          </div>
        )}

        {analise && (
          <div className="flex flex-col gap-4">
            {analise.resumo && (
              <div className="rounded-xl border border-neutral-800 p-4 text-sm leading-relaxed text-neutral-300">
                {analise.resumo}
              </div>
            )}

            {dados?.sugestoes && dados.sugestoes.length > 0 && (
              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-4">
                <p className="mb-3 text-xs font-medium text-emerald-400">
                  O que mudar pra melhorar
                </p>
                <ul className="flex flex-col gap-3">
                  {dados.sugestoes.map((s, i) => (
                    <li key={i} className="text-sm">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            s.prioridade === 'alta'
                              ? 'bg-red-950/60 text-red-300'
                              : s.prioridade === 'media'
                                ? 'bg-amber-950/60 text-amber-300'
                                : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {s.prioridade}
                        </span>
                        <div>
                          <p className="text-neutral-200">{s.mudanca}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">{s.motivo}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {dados?.assuntos && dados.assuntos.length > 0 && (
                <div className="rounded-xl border border-neutral-800 p-4">
                  <p className="mb-3 text-xs text-neutral-500">Assuntos mais perguntados</p>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {dados.assuntos.map((a, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate text-neutral-300">{a.tema}</span>
                        <span className="shrink-0 text-neutral-500">{a.mencoes}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dados?.gargalos && dados.gargalos.length > 0 && (
                <div className="rounded-xl border border-neutral-800 p-4">
                  <p className="mb-3 text-xs text-neutral-500">Gargalos</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {dados.gargalos.map((g, i) => (
                      <li key={i}>
                        <p className="text-neutral-300">{g.problema}</p>
                        <p className="text-xs text-neutral-500">{g.impacto}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dados?.nao_soube_responder && dados.nao_soube_responder.length > 0 && (
                <div className="rounded-xl border border-neutral-800 p-4">
                  <p className="mb-3 text-xs text-neutral-500">
                    Não soube responder (vira base de conhecimento)
                  </p>
                  <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-neutral-300">
                    {dados.nao_soube_responder.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {dados?.erros && dados.erros.length > 0 && (
                <div className="rounded-xl border border-neutral-800 p-4">
                  <p className="mb-3 text-xs text-neutral-500">Erros cometidos</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {dados.erros.map((e, i) => (
                      <li key={i}>
                        <p className="text-neutral-300">{e.descricao}</p>
                        {e.exemplo && (
                          <p className="mt-0.5 border-l-2 border-neutral-800 pl-2 text-xs text-neutral-500 italic">
                            {e.exemplo}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dados?.acertos && dados.acertos.length > 0 && (
                <div className="rounded-xl border border-neutral-800 p-4">
                  <p className="mb-3 text-xs text-neutral-500">O que funcionou bem</p>
                  <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-neutral-300">
                    {dados.acertos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {analises && analises.length > 1 && (
              <details className="rounded-xl border border-neutral-800 p-4">
                <summary className="cursor-pointer text-xs text-neutral-500">
                  Análises anteriores ({analises.length - 1})
                </summary>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {analises.slice(1).map((a) => (
                    <li key={`${a.data_referencia}-${a.periodo_dias}`}>
                      <span className="text-neutral-500">
                        {new Date(`${a.data_referencia}T12:00:00Z`).toLocaleDateString('pt-BR')}:
                      </span>{' '}
                      <span className="text-neutral-300">{a.resumo}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
