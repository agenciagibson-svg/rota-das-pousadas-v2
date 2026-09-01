import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

/**
 * Cliente Supabase para o navegador (Client Components).
 * Usa apenas a anon key pública; toda autorização real é feita por RLS no banco.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database, 'public', any>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
