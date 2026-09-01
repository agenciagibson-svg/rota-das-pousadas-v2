import type { Role } from '@/lib/auth/rbac'

/** Status do ciclo de vida do vínculo — ver supabase/migrations/0014. */
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'

/** Papel de um usuário dentro de uma pousada (tenant). */
export type TenantMembership = {
  id: string
  pousadaId: string
  role: Role
  status: MembershipStatus
  suspendedReason: string | null
}

/** Usuário autenticado resolvido (sessão + profile + papéis). */
export type SessionUser = {
  id: string
  email: string
  name: string
  /** Papel de plataforma (suporte/comercial/marketing/financeiro/master) ou null. */
  platformRole: Role | null
  /** Vínculos com pousadas (multi-tenant). */
  memberships: TenantMembership[]
}
