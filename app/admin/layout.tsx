import { exigirPapel } from '@/lib/auth'
import Shell from '@/components/Shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await exigirPapel(['admin'])
  return (
    <Shell perfil={perfil} ativo="/admin">
      {children}
    </Shell>
  )
}
