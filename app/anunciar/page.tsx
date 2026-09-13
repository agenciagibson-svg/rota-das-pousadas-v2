import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FormPageShell } from '@/components/layout/form-page-shell'
import { CreatePousadaForm } from '@/features/onboarding'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Anuncie sua pousada',
  robots: { index: false, follow: false },
}

export default async function AnunciarPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/anunciar')

  return (
    <FormPageShell
      eyebrow="Para pousadas"
      title="Anuncie sua pousada"
      description="Cadastre sua pousada, gerencie reservas e ganhe distribuição no maior ecossistema de pousadas do Brasil. Sem comissão sobre reservas."
      backHref="/dashboard"
      backLabel="Ir para o painel"
    >
      <CreatePousadaForm />
    </FormPageShell>
  )
}
