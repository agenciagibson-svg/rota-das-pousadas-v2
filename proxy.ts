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

/**
 * Mapas (h8, MapLibre + OpenFreeMap): o estilo, os tiles vetoriais, as
 * fontes e os ícones do mapa são baixados por `fetch` (do navegador e do
 * worker do MapLibre), todos de `tiles.openfreemap.org` — por isso o domínio
 * entra só em `connect-src`. As imagens do mapa viram `blob:`/`data:`, que
 * `img-src` já aceita. Nada muda em `script-src`: o MapLibre é um pacote do
 * próprio app, servido de `/_next/static/`.
 */
const MAP_TILES_ORIGIN = 'https://tiles.openfreemap.org'

const CONNECT_SRC = [
  "'self'",
  'https://*.supabase.co',
  'https://*.supabase.in',
  'https://vitals.vercel-insights.com',
  MAP_TILES_ORIGIN,
]

/**
 * Cloudflare Turnstile (CAPTCHA do pedido de orçamento): o `api.js` é
 * carregado pelo `next/script` depois da hidratação e abre um iframe do mesmo
 * domínio. Sem estas duas liberações a CSP bloqueava o widget, o token saía
 * vazio e TODO pedido de orçamento era recusado.
 */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

/**
 * CSP estrita em TODO o site desde 21/09/2026 — `script-src 'self'
 * 'nonce-…'`, sem `unsafe-inline`. Script inline injetado sem o nonce não
 * executa: é a contenção real de XSS.
 *
 * Isso só é seguro porque toda página do app hoje é dinâmica (renderizada
 * por requisição) — seja por `export const dynamic = 'force-dynamic'`
 * explícito (catálogo, bio), seja porque a página lê `searchParams` ou
 * chama `createSupabaseServerClient()` (que chama `cookies()` internamente
 * — qualquer query via repositório cai nisso), o que já basta pro Next
 * tratar a rota como dinâmica sem precisar do export. O Next só carimba o
 * nonce nos próprios scripts quando existe uma requisição de verdade por
 * trás — por isso a política antiga (`/dashboard`/`/admin` estrita, resto
 * do site com `unsafe-inline` "porque é estático") não valia mais: nenhuma
 * página do site é gerada só uma vez no build.
 *
 * A única exceção real era `app/not-found.tsx`: sem nenhuma leitura de
 * cookie/searchParams/query, o Next pré-renderiza a rota especial
 * `/_not-found` estaticamente no build por padrão — sem requisição, sem
 * nonce. Corrigido forçando `dynamic = 'force-dynamic'` naquele arquivo (ver
 * comentário lá). Os outros `not-found.tsx` (admin/dashboard/pousada/[slug])
 * vivem dentro de segmentos que já são dinâmicos por outro motivo, então não
 * precisaram do mesmo ajuste.
 *
 * `style-src 'unsafe-inline'` continua em todo lugar: `next/font` e o
 * Tailwind injetam estilo inline. Dívida registrada, não esquecimento.
 *
 * `worker-src 'self'` (h8): o MapLibre processa os tiles num Web Worker. O
 * arquivo do worker é publicado pelo Next em `/_next/static/` (ver
 * `components/map/maplibre.ts`), mesmo domínio — sem `blob:`. Antes a
 * diretiva não existia e o navegador caía em `script-src`; explícita, ela
 * vale para o worker do mapa e para o service worker da estadia
 * (`/sw-estadia.js`), ambos do próprio site.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' ${TURNSTILE_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self'",
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
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
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
  { prefix: '/conta', loginPath: '/login' },
  { prefix: '/anunciar', loginPath: '/login' },
  { prefix: '/estadia', loginPath: '/login' },
]

/** Páginas de login dedicadas — sempre públicas, mesmo vivendo sob um prefixo protegido. */
// O manifesto do app da estadia é buscado pelo navegador sem cookie de login.
const PUBLIC_AUTH_PAGES = ['/admin/login', '/estadia/manifest.webmanifest']

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const csp = contentSecurityPolicy(nonce)

  // O Next só carimba o nonce nos próprios scripts se enxergar a CSP no
  // cabeçalho da REQUISIÇÃO — por isso ela vai nos dois lados.
  const extraRequestHeaders = { 'x-nonce': nonce, 'content-security-policy': csp }

  if (!isSupabaseConfigured()) {
    // Modo demonstração (sem Supabase, dados de exemplo): mesmo repasse do
    // caminho normal. Sem ele a CSP bloqueava os scripts do próprio Next e a
    // home ficava parada em "Preparando sua rota…" (ver proxy.test.ts).
    const headers = new Headers(request.headers)
    for (const [name, value] of Object.entries(extraRequestHeaders)) headers.set(name, value)
    return applySecurityHeaders(NextResponse.next({ request: { headers } }), csp)
  }

  const { response, user } = await updateSession(request, extraRequestHeaders)
  const matched = PUBLIC_AUTH_PAGES.includes(path)
    ? undefined
    : PROTECTED.find((p) => path === p.prefix || path.startsWith(`${p.prefix}/`))

  if (matched && !user) {
    const url = request.nextUrl.clone()
    url.pathname = matched.loginPath
    // A query volta junto no `next` (ex.: `?nota=5` do e-mail de avaliação,
    // 0089); na URL do login fica só o `next`.
    url.search = ''
    url.searchParams.set('next', `${path}${request.nextUrl.search}`)
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
