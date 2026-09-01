import 'server-only'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action, type Role } from '@/lib/auth/rbac'

/** Primeira barreira (RBAC de app) para as telas de acomodações — a RLS/RPC no banco é a segunda. */
export async function requireCapability(action: Action): Promise<{ pousadaId: string; role: Role }> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !can(role, action)) throw new Error('Você não tem permissão para esta ação.')
  return { pousadaId, role }
}
