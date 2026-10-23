import { safeNextPath } from './profile'

/**
 * Regras puras do login sem senha (código por e-mail) e do "Continuar com
 * Google". Client-safe: usadas na tela de login, nas actions e nas rotas
 * `/auth/callback` e `/auth/confirm`.
 */

/** Destino padrão de quem entra pela área do hóspede sem `?next=`. */
export const DEFAULT_GUEST_REDIRECT = '/minhas-reservas'

/** Espera mínima entre dois pedidos de código (o Supabase recusa antes de 60s). */
export const RESEND_COOLDOWN_SECONDS = 60

/** Rota que troca o `code` (Google e link padrão do e-mail, fluxo PKCE) pela sessão. */
export const AUTH_CALLBACK_PATH = '/auth/callback'

/** Rota do link do e-mail com `token_hash` (template personalizado). */
export const AUTH_CONFIRM_PATH = '/auth/confirm'

/**
 * `next` aponta para uma reserva em andamento (`/pousada/<slug>/reservar…`)?
 * Nesse caso a tela de login abre com o código por e-mail em destaque.
 */
export function isBookingNextPath(next: string | null | undefined): boolean {
  const safe = safeNextPath(next)
  return safe !== null && /^\/pousada\/[^/?#]+\/reservar(?:[/?#]|$)/.test(safe)
}

/** `/auth/callback?next=…` — para onde o Supabase devolve depois do Google ou do link. */
export function authCallbackPath(next: string | null | undefined): string {
  const safe = safeNextPath(next)
  return safe ? `${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(safe)}` : AUTH_CALLBACK_PATH
}

/** Endereço do login do hóspede que preserva o destino (e um aviso, se houver). */
export function guestLoginPath(next: string | null | undefined, erro?: AuthErrorCode): string {
  const params = new URLSearchParams()
  const safe = safeNextPath(next)
  if (safe) params.set('next', safe)
  if (erro) params.set('erro', erro)
  return params.size > 0 ? `/login?${params.toString()}` : '/login'
}

/**
 * O `next` que chega no link do e-mail. Pode vir como caminho (`/pousada/…`)
 * ou, quando o template usa `{{ .RedirectTo }}`, como URL completa do nosso
 * `/auth/callback?next=…`. Só aceita URL de origem conhecida e desembrulha o
 * callback; qualquer outra coisa vira `null` (cai no destino padrão).
 */
export function nextFromLinkParam(
  value: string | null | undefined,
  allowedOrigins: readonly string[],
): string | null {
  if (!value) return null
  let candidate: string = value
  if (!value.startsWith('/')) {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      return null
    }
    if (!allowedOrigins.includes(url.origin)) return null
    candidate = `${url.pathname}${url.search}`
  }
  const safe = safeNextPath(candidate)
  if (!safe) return null
  const unwrapped = safe.startsWith(`${AUTH_CALLBACK_PATH}?next=`)
    ? callbackInnerNext(safe.slice(AUTH_CALLBACK_PATH.length + '?next='.length))
    : safe === AUTH_CALLBACK_PATH
      ? null
      : safe
  // RedirectTo cai no Site URL (`/`) quando o endereço não está liberado no Supabase.
  return unwrapped === '/' ? null : unwrapped
}

/**
 * O `/auth/callback` só leva o parâmetro `next`, então tudo depois de `next=`
 * é o destino. Dependendo de como o template insere `{{ .RedirectTo }}`, ele
 * chega ainda codificado (`%2Fpousada…`) ou já decodificado (`/pousada…?a=1&b=2`):
 * os dois casos voltam inteiros, sem perder `&guests=…`.
 */
function callbackInnerNext(rest: string): string | null {
  let inner = rest
  if (/^%2F/i.test(rest)) {
    try {
      inner = decodeURIComponent(rest)
    } catch {
      return null
    }
  }
  return safeNextPath(inner)
}

/**
 * Tipos de link de e-mail aceitos em `/auth/confirm`. `email` é o que o
 * template recomendado usa; `magiclink`/`signup` cobrem templates antigos.
 * `recovery` tem fluxo próprio (`/redefinir-senha`) e não entra aqui.
 */
const LINK_TYPES = ['email', 'magiclink', 'signup'] as const
export type EmailLinkType = (typeof LINK_TYPES)[number]

export function emailLinkTypeFrom(value: string | null | undefined): EmailLinkType | null {
  return LINK_TYPES.find((t) => t === value) ?? null
}

/** `token_hash` do Supabase: hexadecimal, às vezes com prefixo `pkce_`. */
export function isPlausibleTokenHash(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{10,512}$/.test(value)
}

/**
 * Avisos que as rotas de retorno mandam para a tela de login (`?erro=`).
 * `retorno`: o `/auth/callback` falhou (Google cancelado ou link padrão do
 * e-mail aberto em outro navegador). `link`: o link de `/auth/confirm` venceu.
 */
export type AuthErrorCode = 'retorno' | 'link'

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  retorno:
    'Não foi possível concluir a entrada. Tente de novo ou receba um código por e-mail — se abriu o link do e-mail em outro navegador, digite o código.',
  link: 'Este link está incompleto, venceu ou já foi usado. Peça um código novo abaixo.',
}

export function authErrorMessage(code: string | null | undefined): string | null {
  return code === 'retorno' || code === 'link' ? AUTH_ERROR_MESSAGES[code] : null
}

/**
 * Origem para onde o Supabase devolve a pessoa (Google e link do e-mail).
 * Produção usa sempre o site oficial — o Host da requisição não manda ali.
 * Preview da Vercel volta para o próprio `*.vercel.app` (o cookie do PKCE foi
 * gravado nesse domínio) e desenvolvimento volta para o `localhost`.
 */
export function authRedirectOrigin(opts: {
  siteUrl: string
  host: string | null | undefined
  vercelEnv: string | undefined
  nodeEnv: string | undefined
}): string {
  const host = opts.host?.split(',')[0]?.trim().toLowerCase() ?? ''
  if (opts.vercelEnv === 'preview' && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/.test(host)) {
    return `https://${host}`
  }
  if (opts.nodeEnv === 'development' && /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(host)) {
    return `http://${host}`
  }
  return opts.siteUrl
}

/**
 * Navegador embutido de app (Instagram, Facebook, TikTok…). O Google recusa
 * login nesses navegadores ("disallowed_useragent"), então ali o botão do
 * Google some e o código por e-mail fica como caminho principal.
 */
export function isEmbeddedBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|musical_ly|TikTok|BytedanceWebview|Line\/|; wv\)/i.test(
    userAgent,
  )
}

/**
 * Nome que o provedor (Google) mandou no `user_metadata`. O Supabase preenche
 * `full_name` e `name`; `given_name`/`family_name` ficam de reserva.
 */
export function nameFromIdentityMetadata(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return ''
  const pick = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string).trim() : '')
  const joined = [pick('given_name'), pick('family_name')].filter(Boolean).join(' ')
  const name = pick('full_name') || pick('name') || joined
  return name.replace(/\s+/g, ' ').slice(0, 150)
}

/** Segundos que faltam para poder reenviar o código. */
export function resendSecondsLeft(sentAtMs: number | null, nowMs: number): number {
  if (sentAtMs === null) return 0
  const left = RESEND_COOLDOWN_SECONDS - Math.floor((nowMs - sentAtMs) / 1000)
  return Math.max(0, Math.min(RESEND_COOLDOWN_SECONDS, left))
}
