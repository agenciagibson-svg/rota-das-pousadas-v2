import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

/**
 * Cliente com a chave `service_role` — ignora RLS por completo.
 *
 * Não usar para ler ou escrever dados de negócio livremente: isso reabriria
 * exatamente os problemas de isolamento entre pousadas que a RLS existe para
 * resolver. Uso restrito a rotinas sem sessão de usuário (cron, webhook,
 * auditoria) — e sempre só chamando RPCs estreitas, `security definer`,
 * concedidas exclusivamente a `service_role`; NUNCA lendo/escrevendo tabela
 * de negócio direto.
 *
 * A auditoria é o caso original: `audit_log` de propósito não tem nenhuma
 * policy de insert para clientes (ver 0013_platform_access_grants.sql) — o
 * único jeito de gravar um evento é o servidor, depois que a autorização
 * real já foi checada em código (`lib/audit/log.ts`).
 *
 * Os demais casos não têm `auth.uid()`, então não podem chamar as RPCs
 * normais (que exigem sessão): webhook do Mercado Pago →
 * `record_payment_and_confirm_booking` (0039); cron de canais (iCal) →
 * `list_channel_feeds_to_import` / `sync_channel_events` (0044,
 * `repositories/channels.repository.ts`); cron de expiração automática de
 * pré-reserva → `expire_overdue_pending_bookings` (0050,
 * `repositories/bookings.repository.ts`). Qualquer novo uso deste cliente
 * fora do padrão "RPC estreita + service_role" deve ser tratado como um
 * problema de design, não como um atalho.
 */
export function createSupabaseServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada — auditoria não pode ser gravada.')
  }
  return createClient<Database, 'public'>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
