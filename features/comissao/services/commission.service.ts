import 'server-only'
import { requireCapability } from '@/lib/auth/require-capability'
import { can } from '@/lib/auth/rbac'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import {
  getCommissionStatementRpc,
  listPlatformCommissionsRpc,
} from '@/repositories/commissions.repository'
import type { CommissionStatement, PlatformCommissions } from '../types'

/**
 * Extratos da comissão da Rota (0104). Só leitura: a comissão é gravada pelo
 * banco no check-out da reserva.
 *
 * Primeira barreira: `finance:pousada:view` (dono, gestor e financeiro) na
 * pousada ATIVA, e `platform_finance:manage` no /admin. A segunda está nas
 * RPCs (`auth_has_finance_access` / `auth_can_manage_platform_finance`).
 */

/** Extrato da pousada ativa. `month` = `YYYY-MM-01`; `null` abre no mês mais recente. */
export async function getCommissionStatement(month: string | null): Promise<CommissionStatement> {
  const { pousadaId } = await requireCapability('finance:pousada:view')
  return getCommissionStatementRpc(pousadaId, month)
}

/** Comissões de todas as pousadas no mês — /admin → Financeiro. */
export async function listPlatformCommissions(month: string | null): Promise<PlatformCommissions> {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'platform_finance:manage')) {
    throw new Error('O financeiro da plataforma é exclusivo de financeiro_plataforma/master.')
  }
  return listPlatformCommissionsRpc(month)
}
