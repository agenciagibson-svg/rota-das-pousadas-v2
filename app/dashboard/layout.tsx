import type { ReactNode } from 'react'
import { resolveTenantAccess } from '@/lib/auth/tenant-context'
import { listPousadaNamesByIds } from '@/repositories/memberships.repository'
import { getMyPendingInvites } from '@/server/queries'
import { isSupabaseConfigured } from '@/lib/env'
import {
  DemoModeScreen,
  NoMembershipScreen,
  InvitedOnlyScreen,
  SuspendedScreen,
  SelectPousadaScreen,
  PendingInvitesBanner,
} from '@/components/dashboard/tenant-gate'
import { DashboardRoleProvider } from '@/components/dashboard/role-context'
import { DashboardNoticesProvider } from '@/components/dashboard/notices-context'
import { getDashboardNotices } from '@/features/dashboard/services/notices.service'

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
      // Preview sem banco: não existe login — oferece a demonstração do painel.
      if (!isSupabaseConfigured()) return <DemoModeScreen />
      return <NoMembershipScreen />
    case 'no_membership':
      return <NoMembershipScreen />

    case 'invited_only': {
      // Pode haver mais de um convite; o usuário responde a cada um (0049).
      return <InvitedOnlyScreen invites={await getMyPendingInvites()} />
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
      const [pousadas, invites] = await Promise.all([
        listPousadaNamesByIds(state.memberships.map((m) => m.pousadaId)),
        getMyPendingInvites(),
      ])
      const options = state.memberships.map((m) => ({
        pousadaId: m.pousadaId,
        name: pousadas.find((p) => p.id === m.pousadaId)?.name ?? 'Pousada',
      }))
      return <SelectPousadaScreen options={options} invites={invites} />
    }

    case 'ok': {
      // Já tem pousada ativa, mas pode ter sido convidado para outra.
      // Avisos do sino: nunca derrubam o painel (cada fonte já falha em silêncio).
      const [invites, notices] = await Promise.all([
        getMyPendingInvites(),
        getDashboardNotices().catch(() => []),
      ])
      return (
        <DashboardRoleProvider role={state.membership.role}>
          <DashboardNoticesProvider notices={notices}>
            <PendingInvitesBanner invites={invites} />
            {children}
          </DashboardNoticesProvider>
        </DashboardRoleProvider>
      )
    }
  }
}
