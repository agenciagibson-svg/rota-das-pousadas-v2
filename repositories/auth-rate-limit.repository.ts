import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Rate limiting de login (migration 0053). `assertLoginNotLocked` lança se o
 * e-mail teve 5+ falhas nos últimos 15 minutos; `recordLoginAttempt` grava o
 * resultado (sucesso ou falha) depois de cada tentativa. Nenhuma das duas
 * expõe a linha da tabela — só a decisão (exceção) ou nada (void).
 */
export async function assertLoginNotLocked(email: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('assert_login_not_locked', { p_email: email })
  if (error) throw new Error(error.message)
}

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  success: boolean,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  // Falha ao registrar a tentativa nunca deve derrubar o login em si — é
  // telemetria de segurança, não parte do fluxo de autenticação.
  const { error } = await supabase.rpc('record_login_attempt', {
    p_email: email,
    p_ip: ip,
    p_success: success,
  })
  if (error) console.error('[auth] falha ao registrar tentativa de login', error.message)
}
