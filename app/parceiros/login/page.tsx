import type { Metadata } from 'next'
import { PartnerLoginShowcase } from '@/components/auth/partner-login-showcase'
import { LoginForm } from '@/features/auth'
import { DemoNotice } from '@/components/demo/demo-notice'
import { isSupabaseConfigured } from '@/lib/env'

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
      {!isSupabaseConfigured() && (
        <DemoNotice
          className="mb-6"
          action={{ href: '/parceiros/demonstracao', label: 'Ver o painel' }}
        >
          Este ambiente de teste não tem banco conectado, então o login não funciona aqui.
        </DemoNotice>
      )}
      <LoginForm variant="partner" next={next} />
    </PartnerLoginShowcase>
  )
}
