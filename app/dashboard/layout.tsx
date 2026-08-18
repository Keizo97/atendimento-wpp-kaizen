import { exigirPapel } from '@/lib/auth'
import Shell from '@/components/Shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await exigirPapel(['admin'])
  return (
    <Shell perfil={perfil} ativo="/dashboard">
      {children}
    </Shell>
  )
}
