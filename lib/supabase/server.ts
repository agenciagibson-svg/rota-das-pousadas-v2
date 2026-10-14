import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
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
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  // `@supabase/ssr` 0.5 não casa os genéricos com o `supabase-js` atual. Em vez
  // de `any` (que desligava a checagem de TODA query e RPC), o cliente é criado
  // sem genérico e devolvido como `SupabaseClient<Database>`: mesmo objeto em
  // tempo de execução, com tabelas, colunas e argumentos de RPC conferidos pelo
  // TypeScript.
  const client = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
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
  return client as unknown as SupabaseClient<Database>
}
