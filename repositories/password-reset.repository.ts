import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

/**
 * "Esqueci minha senha" (0072). As duas operações precisam do service_role:
 * não há sessão (a pessoa esqueceu a senha) e `generateLink` é API admin.
 * Nada aqui revela se o e-mail tem conta — quem chama trata `null` e `false`
 * em silêncio.
 */

/** Reserva uma "vaga" de envio (3/e-mail/15min, 20/IP/h). `false` = não enviar. */
export async function claimPasswordResetSlot(email: string, ip: string | null): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('claim_password_reset_slot', {
    p_email: email,
    p_ip: ip ?? '',
  })
  if (error) throw new Error(error.message)
  return data === true
}

/**
 * Gera o token de recuperação SEM enviar e-mail pelo Supabase — o e-mail sai
 * pelo nosso SMTP, com o visual do site. `null` = e-mail sem conta.
 */
export async function generateRecoveryToken(
  email: string,
): Promise<{ hashedToken: string; name: string | null } | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email })
  const hashedToken = data?.properties?.hashed_token
  if (error || !hashedToken) return null
  const meta = (data.user?.user_metadata ?? {}) as { full_name?: unknown }
  return {
    hashedToken,
    name: typeof meta.full_name === 'string' ? meta.full_name : null,
  }
}
