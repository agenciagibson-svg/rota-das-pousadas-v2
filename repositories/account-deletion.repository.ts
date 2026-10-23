import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

export type AnonymizeStatus = 'deleted' | 'already_deleted'

/**
 * Anonimiza a conta de quem está logado (RPC `delete_my_account`, 0090).
 * Roda com a sessão da pessoa: a RPC só age sobre `auth.uid()` e recusa
 * reserva em andamento, dono de pousada e equipe da plataforma com mensagem
 * em português, que sobe como está.
 */
export async function anonymizeMyAccount(): Promise<AnonymizeStatus> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('delete_my_account')
  if (error) throw new Error(error.message)
  const status = (data as { status?: unknown } | null)?.status
  if (status !== 'deleted' && status !== 'already_deleted') {
    throw new Error(`delete_my_account: resposta inesperada (${String(status)})`)
  }
  return status
}

/**
 * Encerra o usuário no Supabase Auth — exclusão "soft" (0090): o Auth ofusca
 * e-mail e telefone, apaga senha, nome, identidades (Google) e todas as
 * sessões. A linha fica para não quebrar reservas, avaliações e auditoria da
 * pousada, que apontam para ela. API admin: precisa do service_role, e só é
 * chamada DEPOIS de `anonymizeMyAccount`, com o id da sessão já conferida.
 */
export async function softDeleteAuthUser(userId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.auth.admin.deleteUser(userId, true)
  if (error) throw new Error(`auth.admin.deleteUser: ${error.message}`)
}
