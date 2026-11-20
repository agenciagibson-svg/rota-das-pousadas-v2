import type { Metadata } from 'next'
import { FormPageShell } from '@/components/layout/form-page-shell'
import { AnunciarPitch, CreatePousadaForm } from '@/features/onboarding'
import { getCurrentUser } from '@/server/queries'
import { PLATFORM_COMMISSION_LABEL } from '@/lib/platform-commission'

const DESCRIPTION = `Cadastre sua pousada na Rota das Pousadas: reserva direta por Pix ou cartão, calendário, página de reserva para a bio e equipe no mesmo painel. Sem mensalidade, só ${PLATFORM_COMMISSION_LABEL} por reserva trazida pela Rota.`

// Aberta ao Google (20/11/2026): é por aqui que chegam novas pousadas parceiras.
// Sem login, mostra a apresentação; logado, o formulário de cadastro.
export const metadata: Metadata = {
  title: 'Anuncie sua pousada',
  description: DESCRIPTION,
  alternates: { canonical: '/anunciar' },
  openGraph: {
    title: 'Anuncie sua pousada na Rota das Pousadas',
    description: DESCRIPTION,
    url: '/anunciar',
  },
}

export default async function AnunciarPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <FormPageShell
        eyebrow="Para pousadas"
        title="Anuncie sua pousada"
        description={`Reserva direta, calendário e página de reserva para a bio num painel só. Sem mensalidade: só ${PLATFORM_COMMISSION_LABEL} por reserva que a Rota trouxer.`}
      >
        <AnunciarPitch />
      </FormPageShell>
    )
  }

  return (
    <FormPageShell
      eyebrow="Para pousadas"
      title="Anuncie sua pousada"
      description={`Cadastre sua pousada, gerencie reservas e apareça para quem procura pousada na Rota. Sem mensalidade: só ${PLATFORM_COMMISSION_LABEL} por reserva.`}
      backHref="/dashboard"
      backLabel="Ir para o painel"
    >
      <CreatePousadaForm />
    </FormPageShell>
  )
}
