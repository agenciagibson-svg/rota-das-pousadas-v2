import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/auth/rbac'
import type { MembershipStatus } from '@/features/auth/types'

export type MembershipRow = {
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

/** Vínculos não revogados de uma pousada, com nome/e-mail resolvidos à parte (evita embed ambíguo — há 3 FKs de memberships para profiles). */
export async function listMembershipsByPousada(pousadaId: string): Promise<MembershipRow[]> {
  const supabase = await createSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, invited_at, accepted_at, created_at, suspended_reason')
    .eq('pousada_id', pousadaId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: true })
  if (error) throw error

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))]
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const { data: emailRows } = await supabase.rpc('list_membership_emails', { p_pousada_id: pousadaId })
  const emails = (emailRows ?? []) as { user_id: string; email: string }[]
  const emailByUser = new Map(emails.map((r) => [r.user_id, r.email]))

  return (rows ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    fullName: nameByUser.get(r.user_id) || 'Sem nome',
    email: emailByUser.get(r.user_id) ?? null,
    role: r.role as Role,
    status: r.status as MembershipStatus,
    invitedAt: r.invited_at,
    acceptedAt: r.accepted_at,
    createdAt: r.created_at,
    suspendedReason: r.suspended_reason,
  }))
}

export async function getMembershipById(id: string): Promise<{
  id: string
  pousadaId: string
  userId: string
  role: Role
  status: MembershipStatus
} | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, pousada_id, user_id, role, status')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    pousadaId: data.pousada_id,
    userId: data.user_id,
    role: data.role as Role,
    status: data.status as MembershipStatus,
  }
}

/** Quantos vínculos ATIVOS de proprietário a pousada tem — usado para impedir remover o último. */
export async function countActiveOwners(pousadaId: string): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('pousada_id', pousadaId)
    .eq('role', 'proprietario')
    .eq('status', 'active')
  if (error) throw error
  return count ?? 0
}

/**
 * Convida (ou processa neutralmente, se o e-mail não tiver conta) via RPC
 * `invite_membership` — autorização, resolução de e-mail e criação do
 * vínculo acontecem atomicamente dentro do Postgres (SECURITY DEFINER),
 * numa resposta que não distingue "e-mail sem conta" de "convite criado".
 * Ver supabase/migrations/0017_find_profile_by_email_fn.sql.
 */
export async function inviteMembership(input: {
  pousadaId: string
  email: string
  role: Role
}): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('invite_membership', {
    p_pousada_id: input.pousadaId,
    p_email: input.email,
    p_role: input.role,
  })
  if (error) throw new Error(error.message)
}

/**
 * [Ciclo 2C] Todas as mutações de `memberships` abaixo passam por RPCs
 * `SECURITY DEFINER` (supabase/migrations/0020_membership_admin_rpcs_and_finance_scope.sql)
 * — a tabela não tem mais NENHUMA policy de escrita para clientes
 * (`memberships_manage` foi removida). Isso garante que as regras de negócio
 * (último proprietário ativo, autopromoção, vínculo pertence à pousada) valem
 * mesmo para quem chamar a API do Supabase direto, contornando o app.
 */
export async function updateMembershipRole(pousadaId: string, id: string, role: Role): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('update_member_role', {
    p_pousada_id: pousadaId,
    p_membership_id: id,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}

export async function suspendMembership(pousadaId: string, id: string, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('suspend_member', {
    p_pousada_id: pousadaId,
    p_membership_id: id,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}

export async function reactivateMembership(pousadaId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('reactivate_member', {
    p_pousada_id: pousadaId,
    p_membership_id: id,
  })
  if (error) throw new Error(error.message)
}

/** Nome/slug das pousadas de uma lista de ids — usado no seletor de pousada ativa. */
export async function listPousadaNamesByIds(ids: string[]): Promise<{ id: string; name: string; slug: string }[]> {
  if (ids.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('pousadas').select('id, name, slug').in('id', ids)
  if (error) throw error
  return data ?? []
}

export async function revokeMembership(pousadaId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('revoke_member', {
    p_pousada_id: pousadaId,
    p_membership_id: id,
  })
  if (error) throw new Error(error.message)
}
