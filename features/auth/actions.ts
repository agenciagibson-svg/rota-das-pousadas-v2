'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createAction } from '@/actions/create-action'
import { reportError } from '@/lib/observability/report-error'
import { assertLoginNotLocked, recordLoginAttempt } from '@/repositories/auth-rate-limit.repository'
import { getCurrentUser, updateMyName } from './services/auth.service'
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateNameSchema,
} from './schemas'
import { requestPasswordReset, resetPassword } from './services/password-reset.service'
import { saveMyProfile } from './services/profile.service'
import { deleteMyAccount } from './services/account-deletion.service'
import { safeNextPath, travelerProfileSchema } from './profile'
import { ACCOUNT_DELETED_PATH, deleteAccountSchema } from './account-deletion'

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

export const signInAction = createAction(loginSchema, async (input) => {
  const ip = await clientIp()
  await assertLoginNotLocked(input.email, ip)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
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
export const signInAdminAction = createAction(loginSchema, async (input) => {
  const ip = await clientIp()
  await assertLoginNotLocked(input.email, ip)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
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
function signUpErrorMessage(message: string): string {
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

export const signUpAction = createAction(signupSchema, async (input) => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.name } },
  })
  if (error) throw new Error(signUpErrorMessage(error.message))
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
export const requestPasswordResetAction = createAction(forgotPasswordSchema, async (input) => {
  const ip = await clientIp()
  await requestPasswordReset({ email: input.email, ip, audience: input.audience })
  return { sent: true as const }
})

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
