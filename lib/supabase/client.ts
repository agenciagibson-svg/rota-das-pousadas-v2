import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

/**
 * Cliente Supabase para o navegador (Client Components).
 * Usa apenas a anon key pública; toda autorização real é feita por RLS no banco.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  // Mesmo ajuste de tipos de lib/supabase/server.ts (sem `any`).
  return createBrowserClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  ) as unknown as SupabaseClient<Database>
}
