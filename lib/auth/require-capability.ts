import 'server-only'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action, type Role } from '@/lib/auth/rbac'

export type TenantCapability = { pousadaId: string; role: Role }

/**
 * Primeira barreira (RBAC de app) dos Services que operam na pousada ativa —
 * a RLS e as RPCs no banco são a segunda, e as duas precisam concordar.
 *
 * Única implementação: antes havia uma cópia por feature (acomodações, canais,
 * pagamentos, bio, hóspedes, membros, estoque, pedidos), e uma correção em uma
 * não chegava às outras. Os `services/access.ts` das features só reexportam
 * daqui.
 *
 * Confere o papel na pousada ATIVA. Quando a ação recebe o id de um recurso
 * (reserva, quarto, membro...), o Service ainda precisa conferir que o recurso
 * é dessa pousada — ver `requireBookingInActivePousada` em
 * features/reservas/services/bookings.service.ts.
 */
export async function requireAnyCapability(actions: readonly Action[]): Promise<TenantCapability> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !actions.some((action) => can(role, action))) {
    throw new Error('Você não tem permissão para esta ação.')
  }
  return { pousadaId, role }
}

export function requireCapability(action: Action): Promise<TenantCapability> {
  return requireAnyCapability([action])
}
