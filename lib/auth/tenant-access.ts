import type { TenantMembership } from '@/features/auth/types'

/**
 * Decisão PURA de acesso ao tenant — sem I/O (sem cookies, sem sessão),
 * então sem `server-only` e totalmente testável em Vitest (ver
 * tenant-access.test.ts). O wrapper com I/O fica em tenant-context.ts.
 */
export type TenantAccessDecision =
  | { status: 'no_membership' }
  | { status: 'suspended'; membership: TenantMembership }
  | { status: 'invited_only'; membership: TenantMembership }
  | { status: 'needs_selection'; memberships: TenantMembership[] }
  | { status: 'ok'; membership: TenantMembership }

export function classifyTenantAccess(
  memberships: TenantMembership[],
  selectedPousadaId: string | null,
): TenantAccessDecision {
  const nonRevoked = memberships.filter((m) => m.status !== 'revoked')
  if (nonRevoked.length === 0) return { status: 'no_membership' }

  const active = nonRevoked.filter((m) => m.status === 'active')

  if (active.length === 0) {
    const suspended = nonRevoked.find((m) => m.status === 'suspended')
    if (suspended) return { status: 'suspended', membership: suspended }
    return { status: 'invited_only', membership: nonRevoked[0] }
  }

  if (active.length === 1) {
    return { status: 'ok', membership: active[0] }
  }

  const selected = selectedPousadaId ? active.find((m) => m.pousadaId === selectedPousadaId) : undefined
  if (selected) return { status: 'ok', membership: selected }

  return { status: 'needs_selection', memberships: active }
}
