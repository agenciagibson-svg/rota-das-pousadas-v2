'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createAction } from '@/actions/create-action'
import { loginSchema, signupSchema } from './schemas'

/**
 * Server Actions de autenticação. Toda entrada é validada por Zod (createAction)
 * e o retorno é sempre `ActionResult<T>` — a UI trata `ok`/`error`/`fieldErrors`.
 * A navegação pós-sucesso é feita no cliente (não usamos redirect() aqui para
 * não conflitar com o tratamento de erro do createAction).
 */

export const signInAction = createAction(loginSchema, async (input) => {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error) throw new Error('E-mail ou senha inválidos.')
  revalidatePath('/', 'layout')
  return { redirectTo: '/minhas-reservas' as const }
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

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
}
