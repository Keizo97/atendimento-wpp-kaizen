import { exigirPapel } from '@/lib/auth'
import Shell from '@/components/Shell'

export default async function ConfigLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await exigirPapel(['editor', 'admin'])
  return <Shell perfil={perfil}>{children}</Shell>
}
