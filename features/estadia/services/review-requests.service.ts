import 'server-only'
import {
  listReviewRemindersDueRpc,
  listReviewRequestsDueRpc,
  markReviewReminderSentRpc,
  markReviewRequestSentRpc,
  type ReviewRequestTarget,
} from '@/repositories/reviews.repository'
import { sendEmail } from '@/lib/email/mailer'
import { reviewReminderEmail, reviewRequestEmail } from '@/lib/email/templates'

/** Teto de e-mails por rodada (cada tipo): o cron tem 60s e o SMTP do Gmail limita envio. */
export const REVIEW_EMAILS_PER_RUN = 50

export type ReviewEmailsResult = { sent: number; failed: number }

/**
 * Envia um lote e marca cada reserva SÓ depois do envio bem-sucedido. Falha
 * de e-mail (ou de marcação) não derruba as outras: a reserva continua sem
 * marca e volta na rodada seguinte enquanto estiver na janela da RPC.
 */
async function sendBatch(
  targets: ReviewRequestTarget[],
  build: (t: ReviewRequestTarget) => { subject: string; html: string; text: string },
  markSent: (bookingId: string) => Promise<void>,
): Promise<ReviewEmailsResult> {
  let sent = 0
  let failed = 0
  for (const target of targets) {
    try {
      const ok = await sendEmail({ to: target.guestEmail, ...build(target) })
      if (!ok) {
        failed++
        continue
      }
      await markSent(target.bookingId)
      sent++
    } catch (error) {
      failed++
      // Sem e-mail, nome ou assunto no log (LGPD): só a reserva e o erro.
      console.error('[avaliacao] falha no pedido de avaliação', {
        bookingId: target.bookingId,
        error: String(error),
      })
    }
  }
  return { sent, failed }
}

/** Pedido de avaliação 1 a 3 dias depois do check-out (0089). */
export async function sendReviewRequests(
  limit = REVIEW_EMAILS_PER_RUN,
): Promise<ReviewEmailsResult> {
  const targets = await listReviewRequestsDueRpc(limit)
  return sendBatch(targets, reviewRequestEmail, markReviewRequestSentRpc)
}

/** Lembrete único 3 dias depois do pedido, se ainda não avaliou (0089). */
export async function sendReviewReminders(
  limit = REVIEW_EMAILS_PER_RUN,
): Promise<ReviewEmailsResult> {
  const targets = await listReviewRemindersDueRpc(limit)
  return sendBatch(targets, reviewReminderEmail, markReviewReminderSentRpc)
}
