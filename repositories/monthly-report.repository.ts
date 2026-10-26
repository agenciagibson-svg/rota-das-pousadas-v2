import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { ReportBooking } from '@/features/dashboard/monthly-report'
import type { BookingOrigin, BookingStatus } from '@/features/reservas/types'

/**
 * Relatório do mês por e-mail (0097). Só service_role e só RPC estreita
 * (`lib/supabase/service.ts`): o cron não tem sessão, e a prévia do master
 * passa pela mesma porta depois da checagem de papel no service.
 */

export type MonthlyReportPousada = {
  pousadaId: string
  name: string
  timezone: string
  activeRooms: number
}

type PousadaRow = { pousada_id: string; name: string; timezone: string; active_rooms: number }

const toPousada = (r: PousadaRow): MonthlyReportPousada => ({
  pousadaId: r.pousada_id,
  name: r.name,
  timezone: r.timezone,
  activeRooms: Number(r.active_rooms) || 0,
})

/** Pousadas publicadas, com quarto ativo, que ainda não receberam o relatório de `month`. */
export async function listMonthlyReportPousadasRpc(
  month: string,
  limit: number,
): Promise<MonthlyReportPousada[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('list_monthly_report_pousadas', {
    p_month: month,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as PousadaRow[]).map(toPousada)
}

/** Uma pousada qualquer (prévia do master). `null` se não existir. */
export async function getMonthlyReportPousadaRpc(
  pousadaId: string,
): Promise<MonthlyReportPousada | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('get_monthly_report_pousada', {
    p_pousada_id: pousadaId,
  })
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as PousadaRow[])[0]
  return row ? toPousada(row) : null
}

type BookingRow = {
  checkin: string
  checkout: string
  total: number | string
  status: BookingStatus
  origin: BookingOrigin
}

/** Reservas que cruzam `[from, to)` — só datas, valor, status e origem. */
export async function listMonthlyReportBookingsRpc(
  pousadaId: string,
  from: string,
  to: string,
): Promise<ReportBooking[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('list_monthly_report_bookings', {
    p_pousada_id: pousadaId,
    p_from: from,
    p_to: to,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as BookingRow[]).map((b) => ({
    checkin: b.checkin,
    checkout: b.checkout,
    total: Number(b.total) || 0,
    status: b.status,
    origin: b.origin,
  }))
}

/** E-mails do proprietário e do gestor com vínculo ativo. */
export async function listMonthlyReportRecipientsRpc(pousadaId: string): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('list_monthly_report_recipients', {
    p_pousada_id: pousadaId,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean)
}

/** Reserva a vez de enviar. `false` = já enviado ou outra rodada enviando. */
export async function claimMonthlyReportRpc(pousadaId: string, month: string): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('claim_monthly_report', {
    p_pousada_id: pousadaId,
    p_month: month,
  })
  if (error) throw new Error(error.message)
  return data === true
}

/** Marca como enviado. Chamar só depois de pelo menos um e-mail sair. */
export async function markMonthlyReportSentRpc(
  pousadaId: string,
  month: string,
  recipients: number,
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc('mark_monthly_report_sent', {
    p_pousada_id: pousadaId,
    p_month: month,
    p_recipients: recipients,
  })
  if (error) throw new Error(error.message)
}

/** Devolve a vez (nenhum e-mail saiu): a pousada volta na próxima rodada. */
export async function releaseMonthlyReportRpc(pousadaId: string, month: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc('release_monthly_report', {
    p_pousada_id: pousadaId,
    p_month: month,
  })
  if (error) throw new Error(error.message)
}
