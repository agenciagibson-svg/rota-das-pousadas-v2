import 'server-only'
import { publicEnv } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/mailer'
import { passwordChangedEmail, passwordResetEmail } from '@/lib/email/templates'
import {
  claimPasswordResetSlot,
  generateRecoveryToken,
} from '@/repositories/password-reset.repository'
import { RESET_REDIRECT, type ResetAudience } from '../password-reset'

/**
 * Pede o link de nova senha. SEMPRE termina em silêncio (nunca lança): a tela
 * mostra a mesma mensagem exista ou não a conta, esteja ou não no limite —
 * senão o formulário viraria um jeito de descobrir quem tem cadastro.
 */
export async function requestPasswordReset(params: {
  email: string
  ip: string | null
  audience: ResetAudience
}): Promise<void> {
  const email = params.email.trim().toLowerCase()
  try {
    if (!(await claimPasswordResetSlot(email, params.ip))) return
    const token = await generateRecoveryToken(email)
    if (!token) return
    const url = new URL('/redefinir-senha', publicEnv.siteUrl)
    url.searchParams.set('token', token.hashedToken)
    if (params.audience !== 'hospede') url.searchParams.set('para', params.audience)
    const mail = passwordResetEmail({ name: token.name, email, link: url.toString() })
    const sent = await sendEmail({ to: email, ...mail })
    if (!sent) console.error('[auth] e-mail de nova senha não saiu (ver log do mailer)')
  } catch (error) {
    console.error('[auth] falha ao processar pedido de nova senha', String(error))
  }
}

/**
 * Troca a senha usando o token do e-mail. O token só é consumido aqui, no
 * envio do formulário (POST) — nunca ao abrir o link — para que antivírus e
 * pré-visualização de e-mail não "gastem" o link antes do hóspede clicar.
 */
export async function resetPassword(params: {
  token: string
  password: string
  audience: ResetAudience
}): Promise<{ redirectTo: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    type: 'recovery',
    token_hash: params.token,
  })
  if (error || !data.user) {
    throw new Error('Este link expirou ou já foi usado. Peça um novo link abaixo.')
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: params.password })
  if (updateError) {
    const msg = updateError.message.toLowerCase()
    // Mesma senha de antes: a pessoa já está entrando com a senha que digitou.
    if (!msg.includes('different') && !msg.includes('same')) {
      await supabase.auth.signOut().catch(() => undefined)
      if (msg.includes('weak') || msg.includes('pwned') || msg.includes('leak')) {
        throw new Error(
          'Essa senha é fraca ou já apareceu em vazamentos. Peça um novo link e escolha outra.',
        )
      }
      throw new Error('Não foi possível salvar a nova senha. Peça um novo link e tente de novo.')
    }
  } else {
    // Quem tinha a senha antiga (outro aparelho) é desconectado.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined)
    const email = data.user.email
    if (email) {
      const meta = (data.user.user_metadata ?? {}) as { full_name?: unknown }
      const mail = passwordChangedEmail({
        name: typeof meta.full_name === 'string' ? meta.full_name : null,
        loginUrl: new URL('/login', publicEnv.siteUrl).toString(),
        resetUrl: new URL('/esqueci-senha', publicEnv.siteUrl).toString(),
      })
      await sendEmail({ to: email, ...mail })
    }
  }

  return { redirectTo: RESET_REDIRECT[params.audience] }
}
