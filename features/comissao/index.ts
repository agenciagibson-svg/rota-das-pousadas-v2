/**
 * Comissão da Rota por reserva (0104): o banco registra no check-out das
 * reservas vindas da plataforma (pousadas com contrato aceito) e estas telas
 * mostram o extrato — no Financeiro da pousada e no /admin. Ainda não há
 * cobrança.
 */
export type {
  CommissionItem,
  CommissionMonth,
  CommissionStatement,
  PlatformCommissionMonth,
  PlatformCommissionPousada,
  PlatformCommissions,
} from './types'
export {
  findMonth,
  monthLabel,
  monthParam,
  parseMonthParam,
  rateLabel,
  sumCommissionMonths,
  type CommissionTotals,
} from './commission'
