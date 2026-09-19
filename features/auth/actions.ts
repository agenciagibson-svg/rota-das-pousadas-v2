'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createAction } from '@/actions/create-action'
import { assertLoginNotLocked, recordLoginAttempt } from '@/repositories/auth-rate-limit.repository'
import { getCurrentUser, updateMyName } from './services/auth.service'
import { loginSchema, signupSchema, updateNameSchema } from './schemas'

/**
 * Server Actions de autenticação. Toda entrada é validada por Zod (createAction)
 * e o retorno é sempre `ActionResult<T>` — a UI trata `ok`/`error`/`fieldErrors`.
 * A navegação pós-sucesso é feita no cliente (não usamos redirect() aqui para
 * não conflitar com o tratamento de erro do createAction).
 */

/** `x-forwarded-for` só para telemetria do rate limit (migration 0053) — nunca para decisão de acesso. */
async function clientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export const signInAction = createAction(loginSchema, async (input) => {
  const ip = await clientIp()
  await assertLoginNotLocked(input.email)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  await recordLoginAttempt(input.email, ip, !error)
  if (error) throw new Error('E-mail ou senha inválidos.')
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
  await assertLoginNotLocked(input.email)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  await recordLoginAttempt(input.email, ip, !error)
  if (error) throw new Error('E-mail ou senha inválidos.')

  const user = await getCurrentUser()
  if (!user?.platformRole) {
    await supabase.auth.signOut()
    throw new Error('Esta conta não tem acesso ao painel administrativo.')
  }

  revalidatePath('/', 'layout')
  return { redirectTo: '/admin' as const }
})

export const signUpAction = createAction(signupSchema, async (input) => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.name } },
  })
  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      throw new Error('Este e-mail já tem uma conta. Entre com sua senha para continuar.')
    }
    throw new Error(error.message)
  }
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
