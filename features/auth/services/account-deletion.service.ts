import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { reportError } from '@/lib/observability/report-error'
import { anonymizeMyAccount, softDeleteAuthUser } from '@/repositories/account-deletion.repository'
import { getCurrentUser } from './auth.service'
import { EMAIL_MISMATCH_MESSAGE, emailsMatch } from '../account-deletion'

export const AUTH_STEP_FAILED_MESSAGE =
  'Seus dados foram apagados, mas não conseguimos encerrar o acesso agora. Tente de novo em instantes.'

/**
 * Exclui a conta de quem está logado. Ordem importa:
 *   1. confere o e-mail digitado contra o da sessão;
 *   2. RPC `delete_my_account` (precisa da sessão: age sobre auth.uid()) —
 *      recusa reserva em andamento, dono de pousada e equipe; apaga o que é
 *      só da pessoa e desvincula reservas/fichas sem apagá-las;
 *   3. exclusão soft no Auth (service_role) — derruba todas as sessões;
 *   4. limpa o cookie desta sessão.
 * A RPC é idempotente: se o passo 3 falhar, tentar de novo completa o serviço.
 */
export async function deleteMyAccount(confirmEmail: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para continuar.')
  if (!emailsMatch(confirmEmail, user.email)) throw new Error(EMAIL_MISMATCH_MESSAGE)

  await anonymizeMyAccount()

  try {
    await softDeleteAuthUser(user.id)
  } catch (error) {
    console.error('[conta] exclusão no Auth falhou depois da anonimização', String(error))
    await reportError(error, { where: 'action:excluir-conta' })
    throw new Error(AUTH_STEP_FAILED_MESSAGE)
  }

  // As sessões já foram encerradas pelo Auth; isto só apaga o cookie local.
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut().catch(() => undefined)
}
