'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createAction } from '@/actions/create-action'
import { reportError } from '@/lib/observability/report-error'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { publicEnv } from '@/lib/env'
import { assertLoginNotLocked, recordLoginAttempt } from '@/repositories/auth-rate-limit.repository'
import { getCurrentUser, updateMyName } from './services/auth.service'
import {
  emailCodeRequestActionSchema,
  emailCodeVerifySchema,
  emailLinkConfirmSchema,
  forgotPasswordActionSchema,
  googleSignInSchema,
  loginActionSchema,
  resetPasswordSchema,
  signupActionSchema,
  updateNameSchema,
} from './schemas'
import { requestPasswordReset, resetPassword } from './services/password-reset.service'
import { saveMyProfile } from './services/profile.service'
import { deleteMyAccount } from './services/account-deletion.service'
import { safeNextPath, travelerProfileSchema } from './profile'
import { ACCOUNT_DELETED_PATH, deleteAccountSchema } from './account-deletion'
import {
  confirmEmailLink,
  requestEmailCode,
  startGoogleSignIn,
  verifyEmailCode,
} from './services/passwordless.service'
import { authCallbackPath, authRedirectOrigin } from './passwordless'
import { CAPTCHA_FAILED_MESSAGE, captchaOption, isCaptchaError } from './captcha'

/**
 * Server Actions de autenticação. Toda entrada é validada por Zod (createAction)
 * e o retorno é sempre `ActionResult<T>` — a UI trata `ok`/`error`/`fieldErrors`.
 * A navegação pós-sucesso é feita no cliente (não usamos redirect() aqui para
 * não conflitar com o tratamento de erro do createAction).
 */

/**
 * Endereço de quem está tentando entrar. Na Vercel o `x-forwarded-for` é
 * reescrito pela plataforma (o cliente não consegue forjar o primeiro valor).
 * Serve à trava de login (0083: 5 falhas por e-mail + endereço) e ao relatório
 * do /admin — nunca para liberar acesso.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

/**
 * Para onde o Supabase devolve a pessoa (Google e link do e-mail): o site
 * oficial em produção, o próprio domínio no preview da Vercel e o localhost
 * em desenvolvimento (ver `authRedirectOrigin`).
 */
async function redirectOrigin(): Promise<string> {
  const h = await headers()
  return authRedirectOrigin({
    siteUrl: publicEnv.siteUrl,
    host: h.get('x-forwarded-host') ?? h.get('host'),
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  })
}

type SignInError = { message: string; code?: string; status?: number } | null

/**
 * Fecha a tentativa de login. Só credencial errada conta como falha na trava:
 * antes, QUALQUER erro do Supabase Auth virava "senha inválida" e somava
 * tentativa — cinco cliques durante uma instabilidade travavam a conta, e quem
 * tinha a senha certa mas não confirmou o e-mail nunca descobria o motivo.
 */
async function finishSignIn(email: string, ip: string | null, error: SignInError): Promise<void> {
  if (!error) {
    await recordLoginAttempt(email, ip, true)
    return
  }
  // CAPTCHA recusado (token ausente, vencido ou já usado): não é senha errada,
  // não soma tentativa na trava.
  if (isCaptchaError(error)) throw new Error(CAPTCHA_FAILED_MESSAGE)
  const message = error.message.toLowerCase()
  if (error.code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    // O Supabase só responde isto com a senha certa — não é tentativa falha.
    throw new Error(
      'Confirme seu e-mail para entrar: enviamos um link quando você criou a conta. Confira também a caixa de spam.',
    )
  }
  if (error.code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    await recordLoginAttempt(email, ip, false)
    throw new Error('E-mail ou senha inválidos.')
  }
  if (error.status === 429 || message.includes('rate limit') || message.includes('too many')) {
    throw new Error('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.')
  }
  // Instabilidade do serviço de login: não culpa a senha nem soma tentativa.
  console.error('[auth] login indisponível:', error.message.slice(0, 200))
  await reportError(new Error(`Login indisponível: ${error.message.slice(0, 200)}`), {
    where: 'auth:login',
    tags: { status: error.status },
  })
  throw new Error('Não foi possível entrar agora. Tente de novo em instantes.')
}

export const signInAction = createAction(loginActionSchema, async (input) => {
  const ip = await clientIp()
  await assertLoginNotLocked(input.email, ip)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    ...(input.captchaToken && { options: captchaOption(input.captchaToken) }),
  })
  await finishSignIn(input.email, ip, error)
  revalidatePath('/', 'layout')
  return { redirectTo: '/minhas-reservas' as const }
})

/**
 * Login do painel administrativo. Diferente do hóspede/parceiro: a conta
 * pode ter senha certa e mesmo assim não ter acesso — contas de admin são
 * provisionadas só por SQL (docs/features/onboarding-admin.md), então aqui
 * confirmamos `platformRole` DEPOIS da senha bater, e deslogamos de novo se
 * não for staff, em vez de deixar uma sessão autenticada sem propósito.
 */
export const signInAdminAction = createAction(loginActionSchema, async (input) => {
  const ip = await clientIp()
  await assertLoginNotLocked(input.email, ip)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    ...(input.captchaToken && { options: captchaOption(input.captchaToken) }),
  })
  await finishSignIn(input.email, ip, error)

  const user = await getCurrentUser()
  if (!user?.platformRole) {
    await supabase.auth.signOut()
    throw new Error('Esta conta não tem acesso ao painel administrativo.')
  }

  revalidatePath('/', 'layout')
  return { redirectTo: '/admin' as const }
})

/**
 * O Supabase Auth responde em inglês. Traduz os casos que a pessoa consegue
 * resolver sozinha; o resto vira mensagem genérica (o detalhe vai para o log).
 * Com "Confirm email" ligado no projeto, o próprio Supabase não revela se o
 * e-mail já tem conta — o caso "already registered" só aparece sem confirmação.
 */
function signUpErrorMessage(error: { message: string; code?: string }): string {
  if (isCaptchaError(error)) return CAPTCHA_FAILED_MESSAGE
  const message = error.message
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Este e-mail já tem uma conta. Entre com sua senha para continuar.'
  }
  if (m.includes('password')) {
    return 'Escolha uma senha mais forte: pelo menos 8 caracteres, sem ser uma senha comum.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
  }
  if (m.includes('invalid') && m.includes('email')) return 'Confira o e-mail informado.'
  console.error('[auth] cadastro falhou:', message.slice(0, 200))
  return 'Não foi possível criar a conta agora. Tente de novo em instantes.'
}

export const signUpAction = createAction(signupActionSchema, async (input) => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.name },
      // O link do e-mail de confirmação volta para onde a pessoa estava (a reserva).
      emailRedirectTo: `${await redirectOrigin()}${authCallbackPath(input.next)}`,
      ...captchaOption(input.captchaToken),
    },
  })
  if (error) throw new Error(signUpErrorMessage(error))
  revalidatePath('/', 'layout')
  // Sem sessão = projeto exige confirmação de e-mail.
  return { needsEmailConfirmation: !data.session, redirectTo: '/minhas-reservas' as const }
})

/** Completa/corrige o nome do usuário autenticado (ver `updateMyName`). */
export const updateMyNameAction = createAction(updateNameSchema, async (input) => {
  await updateMyName(input.name)
  revalidatePath('/', 'layout')
  return { ok: true as const }
})

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
}

/**
 * "Esqueci minha senha". Resposta idêntica exista ou não a conta (ver
 * `requestPasswordReset`) — a UI sempre mostra "se houver conta, enviamos".
 */
export const requestPasswordResetAction = createAction(
  forgotPasswordActionSchema,
  async (input) => {
    const ip = await clientIp()
    // O link de nova senha sai pelo nosso servidor (service_role), não pelo
    // Supabase Auth — então o CAPTCHA é conferido aqui. Recusa ANTES de tocar
    // no e-mail: a mensagem é a mesma exista ou não a conta.
    if (!(await verifyTurnstileToken(input.captchaToken ?? '', ip))) {
      throw new Error(CAPTCHA_FAILED_MESSAGE)
    }
    await requestPasswordReset({ email: input.email, ip, audience: input.audience })
    return { sent: true as const }
  },
)

/** Nova senha a partir do link do e-mail; já deixa a pessoa logada. */
export const resetPasswordAction = createAction(resetPasswordSchema, async (input) => {
  const result = await resetPassword({
    token: input.token,
    password: input.password,
    audience: input.audience,
  })
  revalidatePath('/', 'layout')
  return result
})

/**
 * Cadastro completo do viajante (0073). Devolve o que ainda falta para
 * reservar e, se veio de uma reserva em andamento, para onde voltar.
 */
export const saveMyProfileAction = createAction(travelerProfileSchema, async (input) => {
  const { missing } = await saveMyProfile(input)
  revalidatePath('/', 'layout')
  return { missing, next: missing.length === 0 ? safeNextPath(input.next) : null }
})

/**
 * Excluir a própria conta (0090). A pessoa digita o próprio e-mail para
 * confirmar; o service anonimiza no banco, encerra no Auth e limpa a sessão.
 */
export const deleteMyAccountAction = createAction(deleteAccountSchema, async (input) => {
  await deleteMyAccount(input.confirmEmail)
  revalidatePath('/', 'layout')
  return { redirectTo: ACCOUNT_DELETED_PATH }
})

/**
 * "Receber código por e-mail" (passo 1). A resposta é a mesma exista ou não
 * a conta — a conta nova é criada por trás no primeiro código.
 */
export const requestEmailCodeAction = createAction(emailCodeRequestActionSchema, async (input) => {
  const [ip, origin] = await Promise.all([clientIp(), redirectOrigin()])
  await requestEmailCode({
    email: input.email,
    next: input.next,
    ip,
    redirectOrigin: origin,
    captchaToken: input.captchaToken,
  })
  return { sent: true as const }
})

/** Passo 2: confere o código e entra. Código errado soma tentativa falha na trava. */
export const verifyEmailCodeAction = createAction(emailCodeVerifySchema, async (input) => {
  const ip = await clientIp()
  const result = await verifyEmailCode({
    email: input.email,
    code: input.code,
    next: input.next,
    ip,
  })
  revalidatePath('/', 'layout')
  return result
})

/** Link do e-mail aberto em `/auth/confirm`: entra quando a pessoa toca no botão. */
export const confirmEmailLinkAction = createAction(emailLinkConfirmSchema, async (input) => {
  const result = await confirmEmailLink({
    tokenHash: input.tokenHash,
    type: input.type,
    next: input.next,
  })
  revalidatePath('/', 'layout')
  return result
})

/**
 * "Continuar com Google": devolve a URL de autorização e o navegador segue
 * (o cookie do PKCE vai junto nesta resposta). Volta por `/auth/callback`.
 */
export const startGoogleSignInAction = createAction(googleSignInSchema, async (input) => {
  return startGoogleSignIn({ next: input.next, redirectOrigin: await redirectOrigin() })
})
