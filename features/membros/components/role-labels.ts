import type { Role } from '@/lib/auth/rbac'
import type { MembershipStatus } from '@/features/auth/types'

/** Papéis de tenant atribuíveis pela tela de equipe. */
export type TeamRole = 'proprietario' | 'admin_pousada' | 'recepcionista' | 'financeiro_pousada' | 'governanca'

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  proprietario: 'Proprietário',
  admin_pousada: 'Gestor',
  recepcionista: 'Recepção',
  financeiro_pousada: 'Financeiro',
  governanca: 'Governança',
}

export function roleLabel(role: Role): string {
  return (TEAM_ROLE_LABEL as Record<string, string>)[role] ?? role
}

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, { label: string; variant: 'primarySoft' | 'goldSoft' | 'destructiveSoft' | 'secondary' }> = {
  invited: { label: 'Convite pendente', variant: 'goldSoft' },
  active: { label: 'Ativo', variant: 'primarySoft' },
  suspended: { label: 'Suspenso', variant: 'destructiveSoft' },
  revoked: { label: 'Revogado', variant: 'secondary' },
}
