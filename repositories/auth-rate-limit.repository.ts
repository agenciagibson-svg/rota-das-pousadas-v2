import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { reportError } from '@/lib/observability/report-error'

/**
 * Rate limiting de login (0053, endurecido na 0083). `assertLoginNotLocked`
 * lança se houve 5+ falhas da MESMA rede para o e-mail nos últimos 15 minutos
 * (ou 30+ falhas daquela rede somando contas); `recordLoginAttempt` grava o
 * resultado depois de cada tentativa.
 *
 * As duas RPCs são executáveis só por `service_role` desde a 0083: enquanto
 * aceitavam `anon`, qualquer pessoa gravava falhas para o e-mail de um dono
 * direto na API e travava o login dele. Por isso este repositório usa o
 * cliente de serviço — é o padrão "RPC estreita + service_role" de
 * `lib/supabase/service.ts`, sem ler nem escrever tabela.
 */
/** SQLSTATE que `assert_login_not_locked` usa para "travado" (0083). */
const LOCKED_CODE = 'P0429'

export async function assertLoginNotLocked(email: string, ip: string | null): Promise<void> {
  let failure: { message: string; code?: string } | null = null
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase.rpc('assert_login_not_locked', {
      p_email: email,
      p_ip: ip ?? undefined,
    })
    if (error) failure = { message: error.message, code: error.code }
  } catch (error) {
    failure = { message: error instanceof Error ? error.message : 'erro desconhecido' }
  }
  if (!failure) return
  // A trava em si chega como exceção da RPC, com código próprio e texto em português.
  if (failure.code === LOCKED_CODE) throw new Error(failure.message)
  // Qualquer outra falha (rede, chave ausente, função fora do ar) não pode
  // deixar ninguém de fora: segue para a senha, que continua sendo conferida
  // pelo Supabase Auth. Vai para o Sentry, porque a trava está desligada.
  console.error('[auth] trava de login indisponível', failure.message)
  await reportError(new Error(`Trava de login indisponível: ${failure.message}`), {
    where: 'auth:login-lock',
  })
}

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  success: boolean,
): Promise<void> {
  // Falha ao registrar a tentativa nunca deve derrubar o login em si — é
  // telemetria de segurança, não parte do fluxo de autenticação.
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase.rpc('record_login_attempt', {
      p_email: email,
      p_ip: ip ?? '',
      p_success: success,
    })
    if (error) console.error('[auth] falha ao registrar tentativa de login', error.message)
  } catch (error) {
    console.error(
      '[auth] falha ao registrar tentativa de login',
      error instanceof Error ? error.message : 'erro desconhecido',
    )
  }
}
