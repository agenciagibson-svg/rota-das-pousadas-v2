import 'server-only'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { classifyTenantAccess } from './tenant-access'
import type { SessionUser, TenantMembership } from '@/features/auth/types'

/**
 * Contexto da pousada ativa (Ciclo 2 — item 7 do escopo de negócio).
 *
 * O cookie é só um atalho de UX para lembrar a última escolha — NUNCA é a
 * fonte de verdade da autorização. Toda leitura aqui revalida o id salvo
 * contra os memberships ATIVOS reais do usuário (vindos da sessão, que por
 * sua vez respeita RLS). Um cookie adulterado ou apontando para uma pousada
 * sem vínculo ativo simplesmente não resolve nenhuma pousada.
 *
 * A decisão em si (`classifyTenantAccess`) é pura e vive em tenant-access.ts
 * — aqui só entra o I/O (sessão + cookie).
 */
export const ACTIVE_POUSADA_COOKIE = 'rp_active_pousada'

export type TenantAccessState =
  | { status: 'unauthenticated' }
  | { status: 'no_membership' }
  | { status: 'suspended'; membership: TenantMembership }
  | { status: 'invited_only'; membership: TenantMembership }
  | { status: 'needs_selection'; memberships: TenantMembership[] }
  | { status: 'ok'; user: SessionUser; membership: TenantMembership }

/** Resolve o estado de acesso à área de gestão para o usuário autenticado. */
export async function resolveTenantAccess(): Promise<TenantAccessState> {
  const user = await getCurrentUser()
  if (!user) return { status: 'unauthenticated' }

  const cookieStore = await cookies()
  const selectedId = cookieStore.get(ACTIVE_POUSADA_COOKIE)?.value ?? null
  const decision = classifyTenantAccess(user.memberships, selectedId)

  if (decision.status === 'ok') {
    return { status: 'ok', user, membership: decision.membership }
  }
  return decision
}

/** Id da pousada ativa, ou null se ainda não resolvida — usado pelos serviços de gestão. */
export async function getActivePousadaId(): Promise<string | null> {
  const state = await resolveTenantAccess()
  return state.status === 'ok' ? state.membership.pousadaId : null
}

/** Papel do usuário na pousada ativa, ou null. */
export async function getActiveTenantRole() {
  const state = await resolveTenantAccess()
  return state.status === 'ok' ? state.membership.role : null
}
