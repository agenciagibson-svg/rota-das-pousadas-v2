import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

/**
 * Cliente Supabase SEM sessão/cookies, para contextos que rodam fora de uma
 * requisição HTTP — `generateStaticParams` (build) e `sitemap`. Lê apenas dados
 * públicos (RLS de leitura pública); nunca usar para dados por usuário.
 */
export function createSupabaseStaticClient() {
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
