import 'server-only'
import { getBookingNotificationContextRpc } from '@/repositories/bookings.repository'
import { sendEmail } from '@/lib/email/mailer'
import { bookingConfirmedEmail } from '@/lib/email/templates'

/**
 * Envia o e-mail de confirmação/"ticket" (0060). Fail-soft: nunca derruba quem
 * chamou — o pagamento já foi gravado nesse ponto. Usado pelo webhook do
 * Mercado Pago e pelo pagamento no balcão que quita uma reserva pendente (0069).
 */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  try {
    const ctx = await getBookingNotificationContextRpc(bookingId)
    if (!ctx || !ctx.guestEmail) return
    const { subject, html, text } = bookingConfirmedEmail(ctx)
    await sendEmail({ to: ctx.guestEmail, subject, html, text })
  } catch (error) {
    console.error(`[email] Falha ao notificar confirmação da reserva ${bookingId}:`, error)
  }
}
