import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PlatformAccessGrant } from '@/features/admin/types'

export type NewGrant = {
  pousadaId: string
  grantedTo: string
  reason: string
  expiresAt: string
}

/**
 * Concede acesso institucional temporário e justificado a uma pousada.
 *
 * Passa pela RPC `grant_platform_access` (0047), não por `insert` direto: a
 * policy de escrita desta tabela foi removida porque aceitava QUALQUER
 * `platform_role` — pela API REST, um usuário de marketing se autoconcedia
 * acesso a reservas, pagamentos e despesas de todas as pousadas, contornando
 * o modelo inteiro da 0013. A RPC exige `master`, justificativa, teto de 7
 * dias e grava a auditoria dentro da mesma transação.
 *
 * `grantedBy` não é mais parâmetro: quem concede é sempre `auth.uid()`, lido
 * no banco. Um chamador não tem como dizer que outra pessoa concedeu.
 */
export async function insertGrant(input: NewGrant): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('grant_platform_access', {
    p_pousada_id: input.pousadaId,
    p_granted_to: input.grantedTo,
    p_reason: input.reason,
    p_expires_at: input.expiresAt,
  })
  if (error) throw new Error(error.message)
  return { id: data as string }
}

/** Revoga uma concessão ativa antes do vencimento natural (RPC da 0047). */
export async function revokeGrant(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('revoke_platform_access', { p_grant_id: id })
  if (error) throw new Error(error.message)
}

/** Concessões ativas (não expiradas, não revogadas) de uma pousada. */
export async function listActiveGrantsByPousada(pousadaId: string): Promise<PlatformAccessGrant[]> {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('platform_access_grants')
    .select('id, pousada_id, granted_to, granted_by, reason, granted_at, expires_at')
    .eq('pousada_id', pousadaId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('granted_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    pousadaId: r.pousada_id,
    grantedTo: r.granted_to,
    grantedBy: r.granted_by,
    reason: r.reason,
    grantedAt: r.granted_at,
    expiresAt: r.expires_at,
  }))
}
