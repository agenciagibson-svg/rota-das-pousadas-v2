import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
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
 *
 * `extraRequestHeaders` permite ao proxy injetar cabeçalhos NA REQUISIÇÃO antes
 * de ela chegar no Next — é assim que o nonce da CSP chega até o renderizador
 * (ver `proxy.ts`). Sem esse repasse, o Next não carimba o nonce nos próprios
 * scripts e a página logada fica em branco com a política aplicada.
 *
 * Os cabeçalhos são remontados a partir de `request.headers` a cada chamada
 * (inclusive dentro de `setAll`), porque o `@supabase/ssr` escreve os cookies
 * renovados em `request.cookies` e conta com que a resposta seguinte os
 * enxergue — congelar um objeto `Headers` aqui perderia a renovação da sessão.
 */
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>,
): Promise<{ response: NextResponse; user: { id: string } | null }> {
  const nextInit = () => {
    if (!extraRequestHeaders) return { request }
    const headers = new Headers(request.headers)
    for (const [name, value] of Object.entries(extraRequestHeaders)) headers.set(name, value)
    return { request: { headers } }
  }

  let response = NextResponse.next(nextInit())

  // Sem genérico de banco: aqui só a sessão (`auth`) é usada. Ver lib/supabase/server.ts.
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next(nextInit())
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Renova o token se necessário (não remover: mantém a sessão viva) e confere
  // a assinatura do token com a chave pública do projeto (ES256), sem ir ao
  // servidor do Auth. Antes era `getUser()`: uma ida aos EUA em TODA
  // requisição de quem está logado (+0,4 a 0,9 s medidos do Brasil em
  // 24/10/2026, até no robots.txt). O proxy só decide se manda para o login;
  // quem lê dado continua conferindo o usuário no servidor (getCurrentUser)
  // e a RLS no banco.
  try {
    const { data, error } = await supabase.auth.getClaims()
    const sub = !error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null
    return { response, user: sub ? { id: sub } : null }
  } catch {
    return { response, user: null }
  }
}
