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
 * A CSP tem dois perfis, e a diferença não é preciosismo — é o que o Next
 * consegue entregar em cada tipo de página.
 *
 * `strict` (rotas logadas): `script-src 'self' 'nonce-…'`, SEM `unsafe-inline`.
 * Script inline injetado sem o nonce não executa — é a contenção real de XSS.
 * Só é possível aqui porque `/dashboard` e `/admin` dependem de sessão e são
 * renderizadas por requisição: o Next lê o nonce do cabeçalho da REQUISIÇÃO e
 * carimba nos próprios scripts.
 *
 * `public` (catálogo, páginas da bio, landing): mantém `'unsafe-inline'` em
 * `script-src`. Página estática é gerada UMA vez no build — não existe nonce
 * por requisição para carimbar, e exigir um deixaria o site em branco. Ainda
 * assim a política é APLICADA (não Report-Only): bloqueia script de origem
 * externa, `object-src`, `base-uri` e `form-action`. É menos do que se quer,
 * e mais do que havia.
 *
 * `style-src 'unsafe-inline'` fica nos dois: `next/font` e o Tailwind injetam
 * estilo inline. Dívida registrada, não esquecimento.
 */
function contentSecurityPolicy(nonce: string | null): string {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'"
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    `connect-src ${CONNECT_SRC.join(' ')}`,
    'upgrade-insecure-requests',
  ].join('; ')
}

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  if (publicEnv.siteUrl.startsWith('https://')) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  response.headers.set('Content-Security-Policy', csp)
  return response
}

/**
 * Rotas que exigem autenticação, e pra qual login dedicado mandar quem não
 * está logado — três portas de entrada (hóspede/parceiro/admin), cada
 * prefixo cai na sua. Autorização fina (papéis) fica no RBAC + RLS.
 */
const PROTECTED: { prefix: string; loginPath: string }[] = [
  { prefix: '/admin', loginPath: '/admin/login' },
  { prefix: '/dashboard', loginPath: '/parceiros/login' },
  { prefix: '/minhas-reservas', loginPath: '/login' },
  { prefix: '/anunciar', loginPath: '/login' },
]

/** Páginas de login dedicadas — sempre públicas, mesmo vivendo sob um prefixo protegido. */
const PUBLIC_AUTH_PAGES = ['/admin/login']

/**
 * Onde a CSP estrita vale. Só áreas de gestão: são as que carregam dado de
 * hóspede, financeiro e configuração, e as únicas garantidamente dinâmicas.
 * Não inclua aqui uma rota que possa ser renderizada estaticamente.
 */
const STRICT_CSP_PREFIXES = ['/dashboard', '/admin']

function usesStrictCsp(path: string): boolean {
  return STRICT_CSP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const nonce = usesStrictCsp(path) ? crypto.randomUUID().replaceAll('-', '') : null
  const csp = contentSecurityPolicy(nonce)

  if (!isSupabaseConfigured()) {
    return applySecurityHeaders(NextResponse.next(), csp)
  }

  // O Next só carimba o nonce nos próprios scripts se enxergar a CSP no
  // cabeçalho da REQUISIÇÃO — por isso ela vai nos dois lados.
  const extraRequestHeaders = nonce ? { 'x-nonce': nonce, 'content-security-policy': csp } : undefined

  const { response, user } = await updateSession(request, extraRequestHeaders)
  const matched = PUBLIC_AUTH_PAGES.includes(path)
    ? undefined
    : PROTECTED.find((p) => path === p.prefix || path.startsWith(`${p.prefix}/`))

  if (matched && !user) {
    const url = request.nextUrl.clone()
    url.pathname = matched.loginPath
    url.searchParams.set('next', path)
    return applySecurityHeaders(NextResponse.redirect(url), csp)
  }

  return applySecurityHeaders(response, csp)
}

export const config = {
  matcher: [
    // Tudo, exceto estáticos e otimização de imagem.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
