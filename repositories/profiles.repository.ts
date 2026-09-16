import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/auth/rbac'
import type { MembershipStatus, TenantMembership } from '@/features/auth/types'

export type ProfileWithRoles = {
  fullName: string
  platformRole: Role | null
  /** Todos os vínculos não revogados — inclui convites pendentes e suspensos,
   * para que a resolução de contexto (lib/auth/tenant-context.ts) possa
   * distinguir "sem vínculo" de "vínculo suspenso"/"convite pendente". */
  memberships: TenantMembership[]
}

/**
 * Lê o profile e os vínculos (memberships) de um usuário. Única porta ao banco
 * para dados de perfil/papéis. Sem regra de negócio (isso é dos Services).
 */
/**
 * Atualiza o nome do profile do próprio usuário (RLS `profiles_self_update`
 * só deixa alterar a própria linha). Não faz upsert: a linha em `profiles` é
 * criada no cadastro (fora do controle desta camada) — se ela não existir, o
 * update afeta zero linhas e isso vira um erro explícito, em vez de falhar
 * calado e deixar o chamador tentando de novo sem nunca dar certo.
 */
export async function updateProfileName(userId: string, fullName: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Não foi possível salvar seu nome. Fale com o suporte.')
  }
}

export async function getProfileWithRoles(userId: string): Promise<ProfileWithRoles | null> {
  const supabase = await createSupabaseServerClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, platform_role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!profile) return null

  const { data: memberships, error: mErr } = await supabase
    .from('memberships')
    .select('id, pousada_id, role, status, suspended_reason')
    .eq('user_id', userId)
  if (mErr) throw mErr

  return {
    fullName: profile.full_name ?? '',
    platformRole: (profile.platform_role as Role | null) ?? null,
    memberships: (memberships ?? []).map((m) => ({
      id: m.id,
      pousadaId: m.pousada_id,
      role: m.role as Role,
      status: m.status as MembershipStatus,
      suspendedReason: m.suspended_reason,
    })),
  }
}
