import { exigirPapel } from '@/lib/auth'
import Shell from '@/components/Shell'

export default async function AtendimentoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await exigirPapel(['gerente', 'admin'])
  return (
    <Shell perfil={perfil} ativo="/atendimento">
      {children}
    </Shell>
  )
}
