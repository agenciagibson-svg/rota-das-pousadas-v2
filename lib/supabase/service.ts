import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

/**
 * Cliente com a chave `service_role` — ignora RLS por completo.
 *
 * Uso restrito a `lib/audit/log.ts` e ao webhook de pagamento
 * (`features/pagamentos/services/webhook.service.ts`). Não usar para ler ou
 * escrever dados de negócio livremente: isso reabriria exatamente os
 * problemas de isolamento entre pousadas que a RLS existe para resolver.
 *
 * A auditoria é o caso original: `audit_log` de propósito não tem nenhuma
 * policy de insert para clientes (ver 0013_platform_access_grants.sql) — o
 * único jeito de gravar um evento é o servidor, depois que a autorização
 * real já foi checada em código.
 *
 * O webhook do Mercado Pago é a única outra exceção, deliberada: ele não tem
 * sessão de usuário (não há `auth.uid()`), então não pode chamar as RPCs
 * normais como `set_booking_status`. Mesmo assim, ele NUNCA lê/escreve tabela
 * diretamente — só chama a RPC estreita e auditada
 * `record_payment_and_confirm_booking` (migration 0039), que é `security
 * definer` e concedida apenas a `service_role`. Qualquer novo uso deste
 * cliente fora desses dois casos deve ser tratado como um problema de design,
 * não como um atalho.
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
