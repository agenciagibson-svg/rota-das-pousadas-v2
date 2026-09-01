import type { ReactNode } from 'react'
import { resolveTenantAccess } from '@/lib/auth/tenant-context'
import { listPousadaNamesByIds } from '@/repositories/memberships.repository'
import {
  NoMembershipScreen,
  InvitedOnlyScreen,
  SuspendedScreen,
  SelectPousadaScreen,
} from '@/components/dashboard/tenant-gate'

/**
 * Guarda de tenant da área de gestão (Ciclo 2 — itens 7 e 8 do escopo de
 * negócio). Roda no servidor, antes de qualquer página de /dashboard/*
 * renderizar — nenhuma página filha precisa repetir esta checagem.
 *
 * `proxy.ts` já garante autenticação; aqui a checagem é de NEGÓCIO: o
 * usuário autenticado precisa de um vínculo ativo com uma pousada para ver
 * qualquer coisa além destes estados de bloqueio.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const state = await resolveTenantAccess()

  switch (state.status) {
    case 'unauthenticated':
    case 'no_membership':
      return <NoMembershipScreen />

    case 'invited_only': {
      const [pousada] = await listPousadaNamesByIds([state.membership.pousadaId])
      return <InvitedOnlyScreen pousadaName={pousada?.name ?? 'uma pousada'} />
    }

    case 'suspended': {
      const [pousada] = await listPousadaNamesByIds([state.membership.pousadaId])
      return (
        <SuspendedScreen
          pousadaName={pousada?.name ?? 'sua pousada'}
          reason={state.membership.suspendedReason}
        />
      )
    }

    case 'needs_selection': {
      const pousadas = await listPousadaNamesByIds(state.memberships.map((m) => m.pousadaId))
      const options = state.memberships.map((m) => ({
        pousadaId: m.pousadaId,
        name: pousadas.find((p) => p.id === m.pousadaId)?.name ?? 'Pousada',
      }))
      return <SelectPousadaScreen options={options} />
    }

    case 'ok':
      return <>{children}</>
  }
}
