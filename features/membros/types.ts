import type { Role } from '@/lib/auth/rbac'
import type { MembershipStatus } from '@/features/auth/types'

/** Membro da equipe de uma pousada — visão da tela de gestão. */
export type TeamMember = {
  id: string
  userId: string
  fullName: string
  email: string | null
  role: Role
  status: MembershipStatus
  invitedAt: string | null
  acceptedAt: string | null
  createdAt: string
  suspendedReason: string | null
}

/** Convite pendente visto pelo PRÓPRIO convidado (tela de entrada do painel). */
export type PendingInvite = {
  membershipId: string
  pousadaId: string
  pousadaName: string
  role: Role
}
