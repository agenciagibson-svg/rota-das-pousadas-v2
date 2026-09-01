import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Respeita a sessão via cookies (RLS aplicada pelo Postgres).
 * NUNCA importar em Client Components.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database, 'public', any>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado de um Server Component (sem permissão de escrita de cookie).
          // A sessão é atualizada pelo middleware — seguro ignorar aqui.
        }
      },
    },
  })
}
