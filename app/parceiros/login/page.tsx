import type { Metadata } from 'next'
import { ToolLoginCard } from '@/components/auth/tool-login-card'
import { LoginForm } from '@/features/auth'

export const metadata: Metadata = {
  title: 'Painel do Parceiro',
  robots: { index: false, follow: false },
}

export default async function ParceirosLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <ToolLoginCard
      title="Painel do Parceiro"
      subtitle="Entre para gerenciar reservas, acomodações e sua equipe."
      accent="primary"
    >
      <LoginForm variant="partner" next={next} />
    </ToolLoginCard>
  )
}
