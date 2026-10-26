import 'server-only'
import { DEFAULT_TIMEZONE, isoDateInTimeZone } from '@/lib/dates'
import { sendEmail, sendEmailWithResult, type SendEmailResult } from '@/lib/email/mailer'
import { monthlyReportEmail } from '@/lib/email/monthly-report-email'
import {
  claimMonthlyReportRpc,
  getMonthlyReportPousadaRpc,
  listMonthlyReportBookingsRpc,
  listMonthlyReportPousadasRpc,
  listMonthlyReportRecipientsRpc,
  markMonthlyReportSentRpc,
  releaseMonthlyReportRpc,
  type MonthlyReportPousada,
} from '@/repositories/monthly-report.repository'
import {
  addMonths,
  buildMonthlyReport,
  monthLabel,
  reportMonthFor,
  type MonthlyReport,
} from '../monthly-report'

/**
 * Relatório do mês por e-mail (0097), pendurado no cron diário
 * `/api/cron/expiracao` (plano Hobby da Vercel: um cron por dia).
 *
 * - Só faz algo nos dias 1, 2 e 3 do mês em Brasília. O dia 1 é o envio
 *   normal; 2 e 3 são as novas tentativas de quem falhou (e o que passou do
 *   teto por rodada). Depois do dia 3 o relatório daquele mês não sai mais —
 *   ninguém quer o resumo de setembro no meio de outubro.
 * - Idempotente: `claim_monthly_report` reserva a vez antes de enviar; rodar
 *   o cron de novo (ou duas rodadas ao mesmo tempo) não manda duas vezes.
 * - Pelo menos um destinatário recebeu → marca enviado (quem já recebeu não
 *   recebe de novo). Nenhum recebeu → devolve a vez para o dia seguinte.
 */
export const MONTHLY_REPORT_DAYS = [1, 2, 3] as const
/** Teto por rodada: o cron tem 60s e divide o tempo com as outras tarefas. */
export const MONTHLY_REPORTS_PER_RUN = 40
/** O dia 1 é o de Brasília para todas as pousadas (o produto é só do Brasil). */
const REPORT_TIMEZONE = DEFAULT_TIMEZONE

export type MonthlyReportsResult =
  | { skipped: true }
  | { skipped: false; month: string; sent: number; failed: number; noRecipients: number }

/** Monta o relatório de uma pousada: busca as reservas dos dois meses e calcula. */
export async function buildPousadaMonthlyReport(
  pousada: MonthlyReportPousada,
  month: string,
): Promise<MonthlyReport> {
  const from = addMonths(month, -1)
  const to = addMonths(month, 1)
  const bookings = await listMonthlyReportBookingsRpc(pousada.pousadaId, from, to)
  return buildMonthlyReport({
    pousadaName: pousada.name,
    bookings,
    totalRooms: pousada.activeRooms,
    month,
  })
}

type SendOutcome = 'sent' | 'failed' | 'no-recipients' | 'skipped'

async function sendOne(pousada: MonthlyReportPousada, month: string): Promise<SendOutcome> {
  if (!(await claimMonthlyReportRpc(pousada.pousadaId, month))) return 'skipped'
  try {
    const [report, recipients] = await Promise.all([
      buildPousadaMonthlyReport(pousada, month),
      listMonthlyReportRecipientsRpc(pousada.pousadaId),
    ])
    if (recipients.length === 0) {
      await releaseMonthlyReportRpc(pousada.pousadaId, month)
      return 'no-recipients'
    }
    const email = monthlyReportEmail(report)
    const results = await Promise.all(recipients.map((to) => sendEmail({ to, ...email })))
    const delivered = results.filter(Boolean).length
    if (delivered === 0) {
      await releaseMonthlyReportRpc(pousada.pousadaId, month)
      return 'failed'
    }
    await markMonthlyReportSentRpc(pousada.pousadaId, month, delivered)
    return 'sent'
  } catch (error) {
    // Sem nome nem e-mail no log (LGPD): só a pousada e o erro.
    console.error('[relatorio-mensal] falha ao enviar', {
      pousadaId: pousada.pousadaId,
      month,
      error: String(error),
    })
    await releaseMonthlyReportRpc(pousada.pousadaId, month).catch(() => undefined)
    return 'failed'
  }
}

/** Tarefa do cron diário. Fora dos dias 1–3 em Brasília não faz nada. */
export async function sendMonthlyReports(
  now = new Date(),
  limit = MONTHLY_REPORTS_PER_RUN,
): Promise<MonthlyReportsResult> {
  const today = isoDateInTimeZone(now, REPORT_TIMEZONE)
  const day = Number(today.slice(8, 10))
  if (!(MONTHLY_REPORT_DAYS as readonly number[]).includes(day)) return { skipped: true }

  const month = reportMonthFor(today)
  const pousadas = await listMonthlyReportPousadasRpc(month, limit)
  let sent = 0
  let failed = 0
  let noRecipients = 0
  for (const pousada of pousadas) {
    const outcome = await sendOne(pousada, month)
    if (outcome === 'sent') sent++
    else if (outcome === 'failed') failed++
    else if (outcome === 'no-recipients') noRecipients++
  }
  return { skipped: false, month, sent, failed, noRecipients }
}

export type MonthlyReportPreviewResult = SendEmailResult & {
  to: string
  month: string
  monthLabel: string
}

/**
 * Prévia (botão do master no /admin): relatório do mês anterior de UMA
 * pousada, só para `to`. Não reserva a vez nem marca enviado. A checagem de
 * papel fica em quem chama (`features/admin/services/maintenance.service.ts`).
 */
export async function sendMonthlyReportPreview(
  pousadaId: string,
  to: string,
  now = new Date(),
): Promise<MonthlyReportPreviewResult> {
  const pousada = await getMonthlyReportPousadaRpc(pousadaId)
  if (!pousada) throw new Error('Pousada não encontrada.')
  const month = reportMonthFor(isoDateInTimeZone(now, REPORT_TIMEZONE))
  const report = await buildPousadaMonthlyReport(pousada, month)
  const result = await sendEmailWithResult({ to, ...monthlyReportEmail(report, { preview: true }) })
  return { ...result, to, month, monthLabel: monthLabel(month) }
}
