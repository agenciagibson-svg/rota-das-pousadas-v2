import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { publicEnv } from '@/lib/env'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

/**
 * Atualiza/renova a sessão do Supabase a cada request (padrão @supabase/ssr).
 * Deve ser chamado pelo proxy raiz. Retorna a resposta com cookies sincronizados
 * e o usuário autenticado (ou null). Não coloque autorização de negócio aqui —
 * isso é RBAC (aplicação) + RLS (banco); aqui só há gate de autenticação.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database, 'public', any>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Renova o token se necessário (não remover: mantém a sessão viva).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
