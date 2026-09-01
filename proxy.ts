import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isSupabaseConfigured, publicEnv } from '@/lib/env'

/**
 * Proxy raiz (convenção do Next 16, substitui `middleware.ts`) — executa em
 * toda requisição de página.
 *
 * Responsabilidades:
 *  1. Renovar a sessão do Supabase (quando configurado) — mantém o JWT vivo.
 *  2. Aplicar cabeçalhos de segurança (defesa em profundidade).
 *  3. Aplicar CSP.
 *
 * NÃO faz autorização de negócio (isso é RBAC nos Services + RLS no Postgres).
 */

const CONNECT_SRC = ["'self'", 'https://*.supabase.co', 'https://*.supabase.in', 'https://vitals.vercel-insights.com']

/**
 * CSP forte. Publicada em **Report-Only** para rollout seguro (coleta violações
 * sem quebrar a aplicação). Após validação em staging, renomear o header para
 * `Content-Security-Policy` e migrar scripts para nonce/`strict-dynamic`.
 */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${CONNECT_SRC.join(' ')}`,
    'upgrade-insecure-requests',
  ].join('; ')
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  if (publicEnv.siteUrl.startsWith('https://')) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  response.headers.set('Content-Security-Policy-Report-Only', contentSecurityPolicy())
  return response
}

/** Rotas que exigem autenticação. Autorização fina (papéis) fica no RBAC + RLS. */
const PROTECTED = ['/dashboard', '/admin', '/minhas-reservas', '/anunciar']

export default async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return applySecurityHeaders(NextResponse.next())
  }

  const { response, user } = await updateSession(request)
  const path = request.nextUrl.pathname
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))

  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    // Tudo, exceto estáticos e otimização de imagem.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
