import 'server-only'
import { listAndMarkCheckinRemindersRpc } from '@/repositories/bookings.repository'
import { sendEmail } from '@/lib/email/mailer'
import { checkinReminderEmail } from '@/lib/email/templates'

/**
 * Lembrete de check-in por e-mail (0060). Roda 1x/dia junto com
 * `expireOverduePendingBookings` — ver comentário em
 * `app/api/cron/expiracao/route.ts` sobre por que dividem o mesmo cron.
 *
 * `listAndMarkCheckinRemindersRpc` já marca `checkin_reminder_sent_at` antes
 * de retornar (RPC atômica, 0060) — uma falha de envio aqui não reenvia no
 * dia seguinte; é aceitável nesta fase (falha isolada, não recorrente).
 */
export async function sendCheckinReminders(
  daysAhead = 2,
): Promise<{ sent: number; failed: number }> {
  const reminders = await listAndMarkCheckinRemindersRpc(daysAhead)
  let sent = 0
  let failed = 0
  for (const ctx of reminders) {
    if (!ctx.guestEmail) continue
    const { subject, html, text } = checkinReminderEmail(ctx)
    const ok = await sendEmail({ to: ctx.guestEmail, subject, html, text })
    if (ok) sent++
    else failed++
  }
  return { sent, failed }
}
