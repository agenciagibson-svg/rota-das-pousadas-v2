import { timingSafeEqual } from 'node:crypto'
import { expireOverduePendingBookings } from '@/features/reservas/services/expire-overdue.service'
import { purgeStaleQuoteRequests } from '@/features/bio/services/bio.service'
import { sendCheckinReminders } from '@/features/reservas/services/checkin-reminders.service'
import { notifyPaymentReviews } from '@/features/pagamentos/services/pix.service'

/**
 * Rodada diária de manutenção: expira pré-reserva vencida, purga pedido de
 * orçamento não convertido com mais de 180 dias (0059, LGPD) e envia lembrete
 * de check-in por e-mail pras reservas confirmadas de daqui a 2 dias (0060).
 * As três tarefas dividem o mesmo cron de propósito — o plano Hobby da
 * Vercel só permite cron 1x/dia, então um cron novo só pra isso custaria uma
 * segunda rodada diária que não sobra.
 *
 * Disparada pelo Vercel Cron (ver `vercel.json`), que envia
 * `Authorization: Bearer <CRON_SECRET>` — mesmo segredo e mesmo padrão de
 * `/api/cron/canais`. Sem o segredo correto a rota responde 401.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    // allSettled: uma tarefa que falha não esconde as outras que rodaram.
    const [bookings, quoteRequests, checkinReminders] = await Promise.allSettled([
      expireOverduePendingBookings(),
      purgeStaleQuoteRequests(),
      sendCheckinReminders(),
    ])
    // Depois da expiração: reservas que caíram com comprovante em análise
    // entram na fila de revisão (0082) e a pousada é avisada por e-mail.
    const paymentReviews = await notifyPaymentReviews()
    const out = (r: PromiseSettledResult<unknown>, name: string) => {
      if (r.status === 'fulfilled') return r.value
      console.error(`[cron] ${name} falhou`, String(r.reason))
      return { error: 'falhou' }
    }
    const failed = [bookings, quoteRequests, checkinReminders].some((r) => r.status === 'rejected')
    return Response.json(
      {
        bookings: out(bookings, 'expiracao'),
        quoteRequests: out(quoteRequests, 'orcamentos'),
        checkinReminders: out(checkinReminders, 'lembretes'),
        paymentReviews,
      },
      { status: failed ? 500 : 200 },
    )
  } catch (error) {
    console.error('[cron] expiracao falhou', String(error))
    return Response.json({ error: 'Falha inesperada.' }, { status: 500 })
  }
}
