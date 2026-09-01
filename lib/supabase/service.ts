import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

/**
 * Cliente com a chave `service_role` — ignora RLS por completo.
 *
 * Uso ESTRITAMENTE restrito a `lib/audit/log.ts`. Não usar para ler ou
 * escrever dados de negócio: isso reabriria exatamente os problemas de
 * isolamento entre pousadas que a RLS existe para resolver. A auditoria é
 * o único caso legítimo porque `audit_log` de propósito não tem nenhuma
 * policy de insert para clientes (ver 0013_platform_access_grants.sql) — o
 * único jeito de gravar um evento é o servidor, depois que a autorização
 * real já foi checada em código.
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
