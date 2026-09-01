import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PlatformAccessGrant } from '@/features/admin/types'

export type NewGrant = {
  pousadaId: string
  grantedTo: string
  grantedBy: string
  reason: string
  expiresAt: string
}

/** Concede acesso institucional temporário e justificado a uma pousada. */
export async function insertGrant(input: NewGrant): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('platform_access_grants')
    .insert({
      pousada_id: input.pousadaId,
      granted_to: input.grantedTo,
      granted_by: input.grantedBy,
      reason: input.reason,
      expires_at: input.expiresAt,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

/** Revoga uma concessão ativa antes do vencimento natural. */
export async function revokeGrant(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('platform_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
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
