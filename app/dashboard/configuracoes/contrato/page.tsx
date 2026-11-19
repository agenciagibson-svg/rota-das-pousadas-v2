import type { Metadata } from 'next'
import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getOwnerAcceptedContract,
  getOwnerContractState,
  getOwnerPousada,
} from '@/server/queries'
import { ContractView } from '@/features/contrato/components/contract-view'

export const metadata: Metadata = {
  title: 'Contrato — Painel',
  robots: { index: false, follow: false },
}

export default async function DashboardContratoPage() {
  if (await sectionDenied('configuracoes'))
    return <NoSectionAccess section="configuracoes" title="Contrato" />

  const [user, pousada, state] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerContractState(),
  ])
  // Papel sem `contract:view` (recepção, governança, financeiro) não abre esta página.
  if (!state) return <NoSectionAccess section="configuracoes" title="Contrato" />

  const accepted = state.acceptedCurrent ? await getOwnerAcceptedContract() : null
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <ContractView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      state={state}
      accepted={accepted}
      nowISO={new Date().toISOString()}
    />
  )
}
