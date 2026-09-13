import type { Metadata } from 'next'
import { ToolLoginCard } from '@/components/auth/tool-login-card'
import { LoginForm } from '@/features/auth'

export const metadata: Metadata = {
  title: 'Painel Administrativo',
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <ToolLoginCard
      title="Painel Administrativo"
      subtitle="Acesso restrito à equipe da Rota das Pousadas."
    >
      <LoginForm variant="admin" next={next} />
    </ToolLoginCard>
  )
}
