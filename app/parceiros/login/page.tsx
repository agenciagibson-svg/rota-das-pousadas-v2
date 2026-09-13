import type { Metadata } from 'next'
import { PartnerLoginShowcase } from '@/components/auth/partner-login-showcase'
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
    <PartnerLoginShowcase
      title="Painel do Parceiro"
      subtitle="Entre para gerenciar reservas, acomodações e sua equipe."
    >
      <LoginForm variant="partner" next={next} />
    </PartnerLoginShowcase>
  )
}
