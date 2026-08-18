// Motor de analise diaria. Chamado pelo agendador das 8h (GitHub Actions,
// Coolify scheduled task, cron externo — tanto faz, e so um POST com secret).
//
//   POST /api/cron/analise?secret=CRON_SECRET
//
// Sem parametro, analisa ONTEM (dia ja fechado, em horario de Brasilia).
// Aceita ?dia=2026-08-17 e ?dias=7 pra rodar um periodo especifico na mao.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarAnalise } from '@/lib/analise/gerar'
import { ontemBrasilia } from '@/lib/analise/periodo'
import { getPerfil } from '@/lib/auth'

// Analise de 30 dias pode demorar. Sem isso, alguns hosts cortam em 10s.
export const maxDuration = 300

async function autorizado(request: NextRequest): Promise<boolean> {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) return true

  // Tambem aceita admin logado, pro botao "rodar agora" do dashboard.
  const perfil = await getPerfil()
  return perfil?.role === 'admin'
}

export async function POST(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  }

  const dia = request.nextUrl.searchParams.get('dia') || ontemBrasilia()
  const dias = Number(request.nextUrl.searchParams.get('dias') || 1)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return NextResponse.json({ erro: 'dia deve estar no formato AAAA-MM-DD' }, { status: 400 })
  }
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
    return NextResponse.json({ erro: 'dias deve ser um inteiro entre 1 e 90' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const resultado = await gerarAnalise(admin, { dia, periodoDias: dias })

    console.log(
      `[cron analise] dia=${dia} dias=${dias} ok=${resultado.ok} conversas=${resultado.totalConversas} ${resultado.motivo ?? ''}`
    )

    return NextResponse.json({ ...resultado, dia, dias })
  } catch (err) {
    const motivo = err instanceof Error ? err.message : 'erro desconhecido'
    console.error('[cron analise] falhou:', motivo)
    return NextResponse.json({ ok: false, motivo }, { status: 500 })
  }
}
