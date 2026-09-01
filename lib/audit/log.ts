import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/database.types'

export type AuditEntry = {
  actorId: string
  action: string
  targetTable?: string
  targetId?: string
  metadata?: Record<string, unknown>
}

/**
 * Registra um evento de auditoria (Ciclo 2 — item 19 do escopo de negócio).
 *
 * [Revisão Ciclo 2B] Grava via service role, NUNCA com o client de sessão —
 * `audit_log` não tem nenhuma policy de insert para clientes (ver
 * 0013_platform_access_grants.sql), então esta é a única forma de escrever.
 * Por construção, só o SERVIDOR chama `logAudit`, e sempre DEPOIS de o
 * chamador (service/action) já ter checado a permissão real — o evento
 * gravado corresponde a algo que realmente foi autorizado e executado, não a
 * uma alegação do cliente. Falha de auditoria não derruba a operação de
 * negócio — loga e segue.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.from('audit_log').insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    metadata: (entry.metadata ?? {}) as Json,
  })
  if (error) {
    console.error('[audit] falha ao registrar evento', entry.action, error)
  }
}
