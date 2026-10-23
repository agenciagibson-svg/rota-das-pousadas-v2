import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isGoogleAuthEnabled, publicEnv } from '@/lib/env'
import { reportError } from '@/lib/observability/report-error'
import { assertLoginNotLocked, recordLoginAttempt } from '@/repositories/auth-rate-limit.repository'
import { getProfileWithRoles, updateProfileName } from '@/repositories/profiles.repository'
import {
  DEFAULT_GUEST_REDIRECT,
  authCallbackPath,
  nameFromIdentityMetadata,
  type EmailLinkType,
} from '../passwordless'
import { safeNextPath } from '../profile'

/**
 * Entrar sem senha: código de 6 números por e-mail (Supabase `signInWithOtp`
 * + `verifyOtp`) e "Continuar com Google" (`signInWithOAuth`, fluxo PKCE do
 * `@supabase/ssr`). A conta é criada por trás no primeiro acesso.
 *
 * Mensagens neutras: nada aqui diz se o e-mail já tinha conta. Código errado
 * conta como tentativa falha na mesma trava do login com senha (0053/0083).
 */

type AuthError = { message: string; code?: string; status?: number } | null

const TOO_MANY = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
const UNAVAILABLE = 'Não foi possível entrar agora. Tente de novo em instantes.'
const WRONG_CODE = 'Código inválido ou vencido. Confira os números ou peça um código novo.'

function isRateLimited(error: NonNullable<AuthError>): boolean {
  const m = error.message.toLowerCase()
  return (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit' ||
    m.includes('rate limit') ||
    m.includes('too many') ||
    m.includes('security purposes')
  )
}

async function unavailable(where: string, error: NonNullable<AuthError>): Promise<never> {
  console.error(`[auth] ${where} indisponível:`, error.message.slice(0, 200))
  await reportError(new Error(`${where} indisponível: ${error.message.slice(0, 200)}`), {
    where: `auth:${where}`,
    tags: { status: error.status, code: error.code },
  })
  throw new Error(UNAVAILABLE)
}

/** Destino validado depois de entrar. */
export function redirectAfterSignIn(next: string | null | undefined): string {
  return safeNextPath(next) ?? DEFAULT_GUEST_REDIRECT
}

/**
 * Envia o código. O e-mail sempre sai igual para conta nova e antiga (a
 * resposta da tela também), e um endereço travado por código errado não
 * dispara mais e-mails até a trava vencer.
 */
export async function requestEmailCode(params: {
  email: string
  next: string | undefined
  ip: string | null
  redirectOrigin: string
}): Promise<void> {
  const email = params.email.trim().toLowerCase()
  await assertLoginNotLocked(email, params.ip)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // Link do e-mail (se o template trouxer link): volta para a reserva.
      emailRedirectTo: `${params.redirectOrigin}${authCallbackPath(params.next)}`,
    },
  })
  if (!error) return
  if (isRateLimited(error)) throw new Error(TOO_MANY)
  const m = error.message.toLowerCase()
  if (error.code === 'email_address_invalid' || (m.includes('invalid') && m.includes('email'))) {
    throw new Error('Confira o e-mail informado.')
  }
  await unavailable('codigo-email', error)
}

/** Confere o código digitado e abre a sessão. */
export async function verifyEmailCode(params: {
  email: string
  code: string
  next: string | undefined
  ip: string | null
}): Promise<{ redirectTo: string }> {
  const email = params.email.trim().toLowerCase()
  await assertLoginNotLocked(email, params.ip)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ email, token: params.code, type: 'email' })
  if (!error) {
    await recordLoginAttempt(email, params.ip, true)
    return { redirectTo: redirectAfterSignIn(params.next) }
  }
  if (isRateLimited(error)) throw new Error(TOO_MANY)
  // O Supabase responde igual para código errado, vencido ou já usado
  // ("Token has expired or is invalid", `otp_expired`, 403).
  const m = error.message.toLowerCase()
  if (
    error.code === 'otp_expired' ||
    error.code === 'otp_disabled' ||
    error.status === 403 ||
    m.includes('expired') ||
    m.includes('invalid')
  ) {
    await recordLoginAttempt(email, params.ip, false)
    throw new Error(WRONG_CODE)
  }
  return unavailable('codigo-email', error)
}

/**
 * Link do e-mail (`/auth/confirm?token_hash=…`). Consumido só quando a
 * pessoa toca em "Entrar" (POST): antivírus e pré-visualização de e-mail
 * abrem links sozinhos e, com um GET, gastariam o link E o código, que são o
 * mesmo token no Supabase.
 */
export async function confirmEmailLink(params: {
  tokenHash: string
  type: EmailLinkType
  next: string | undefined
}): Promise<{ redirectTo: string }> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: params.tokenHash,
    type: params.type,
  })
  if (!error) return { redirectTo: redirectAfterSignIn(params.next) }
  if (isRateLimited(error)) throw new Error(TOO_MANY)
  const m = error.message.toLowerCase()
  if (error.status === 403 || error.code === 'otp_expired' || m.includes('expired')) {
    throw new Error('Este link venceu ou já foi usado. Peça um código novo para entrar.')
  }
  return unavailable('link-email', error)
}

/**
 * Começa o "Continuar com Google". Devolve a URL do Google para o navegador
 * seguir; o verificador do PKCE fica num cookie desta resposta, e
 * `/auth/callback` troca o `code` pela sessão.
 */
export async function startGoogleSignIn(params: {
  next: string | undefined
  redirectOrigin: string
}): Promise<{ url: string }> {
  if (!isGoogleAuthEnabled()) throw new Error('Entrar com Google não está disponível agora.')
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${params.redirectOrigin}${authCallbackPath(params.next)}`,
      skipBrowserRedirect: true,
      // Deixa a pessoa escolher a conta (celular compartilhado é comum).
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error || !data?.url) {
    return unavailable('google', error ?? { message: 'URL do Google ausente' })
  }
  // Só segue para o endereço de autorização do próprio Supabase.
  if (!data.url.startsWith(`${publicEnv.supabaseUrl}/auth/v1/`)) {
    return unavailable('google', { message: 'URL de autorização inesperada' })
  }
  return { url: data.url }
}

/**
 * Quem entra pelo Google traz o nome no `user_metadata`. O gatilho
 * `handle_new_user` (0003) já copia `full_name` na criação da conta; isto cobre
 * o resto: conta que existia sem nome (criada pelo código por e-mail) e
 * provedor que só manda `name`. Nunca sobrescreve um nome já preenchido e
 * nunca impede a entrada.
 */
export async function fillProfileNameFromIdentity(user: User): Promise<void> {
  try {
    const name = nameFromIdentityMetadata(user.user_metadata)
    if (name.length < 2) return
    const profile = await getProfileWithRoles(user.id)
    if (!profile || profile.fullName.trim()) return
    await updateProfileName(user.id, name)
  } catch (error) {
    console.error(
      '[auth] não foi possível completar o nome pelo provedor',
      error instanceof Error ? error.message.slice(0, 200) : 'erro desconhecido',
    )
  }
}

/** Troca o `code` do retorno (Google ou link padrão do e-mail) pela sessão. */
export async function exchangeAuthCode(code: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    // Comum e esperado: link aberto em outro navegador (sem o cookie do PKCE).
    console.error('[auth] troca do código falhou:', error?.message.slice(0, 200) ?? 'sem usuário')
    return false
  }
  await fillProfileNameFromIdentity(data.user)
  return true
}
