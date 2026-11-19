import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  CommissionItem,
  CommissionMonth,
  CommissionStatement,
  PlatformCommissionMonth,
  PlatformCommissionPousada,
  PlatformCommissions,
} from '@/features/comissao/types'

/**
 * Comissão da Rota por reserva (0104). Só leitura, por RPC: a tabela não tem
 * acesso pela API e o valor é calculado no banco, no check-out.
 */

type Raw = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const rows = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])

function toMonth(r: Raw): CommissionMonth {
  return {
    month: str(r.month),
    bookings: num(r.bookings),
    base: num(r.base),
    due: num(r.due),
    waived: num(r.waived),
  }
}

export async function getCommissionStatementRpc(
  pousadaId: string,
  month: string | null,
): Promise<CommissionStatement> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_pousada_commission_statement', {
    p_pousada_id: pousadaId,
    // Sem mês: o argumento não vai, e o banco abre no mês mais recente.
    ...(month ? { p_month: month } : {}),
  })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as Raw
  return {
    rate: num(r.rate),
    hasContract: r.hasContract === true,
    exemptUntil: strOrNull(r.exemptUntil),
    month: str(r.month),
    months: rows(r.months).map(toMonth),
    items: rows(r.items).map((i): CommissionItem => ({
      bookingId: str(i.bookingId),
      code: str(i.code),
      checkin: str(i.checkin),
      checkout: str(i.checkout),
      origin: str(i.origin),
      base: num(i.base),
      rate: num(i.rate),
      amount: num(i.amount),
      exempt: i.exempt === true,
    })),
  }
}

export async function listPlatformCommissionsRpc(
  month: string | null,
): Promise<PlatformCommissions> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    'list_platform_commissions',
    month ? { p_month: month } : {},
  )
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as Raw
  return {
    rate: num(r.rate),
    month: str(r.month),
    months: rows(r.months).map((m): PlatformCommissionMonth => ({
      ...toMonth(m),
      pousadas: num(m.pousadas),
    })),
    pousadas: rows(r.pousadas).map((p): PlatformCommissionPousada => ({
      pousadaId: str(p.pousadaId),
      name: str(p.name),
      founderRank: typeof p.founderRank === 'number' ? p.founderRank : null,
      exemptUntil: strOrNull(p.exemptUntil),
      bookings: num(p.bookings),
      base: num(p.base),
      due: num(p.due),
      waived: num(p.waived),
    })),
  }
}
