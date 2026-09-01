import type { Role } from '@/lib/auth/rbac'

/**
 * Verdadeiro se rebaixar, suspender ou revogar este vínculo deixaria a
 * pousada sem nenhum proprietário ativo. Regra pura — sem I/O — para ser
 * testável sem depender do banco (ver rules.test.ts).
 */
export function wouldLeaveNoActiveOwner(membershipRole: Role, activeOwnerCount: number): boolean {
  return membershipRole === 'proprietario' && activeOwnerCount <= 1
}

/** Verdadeiro se o ator estiver tentando agir sobre o próprio vínculo. */
export function isSelfAction(membershipUserId: string, actorUserId: string): boolean {
  return membershipUserId === actorUserId
}
