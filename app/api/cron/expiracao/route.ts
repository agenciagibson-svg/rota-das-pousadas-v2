import { timingSafeEqual } from 'node:crypto'
import { expireOverduePendingBookings } from '@/features/reservas/services/expire-overdue.service'
import { purgeStaleQuoteRequests } from '@/features/bio/services/bio.service'
import { sendCheckinReminders } from '@/features/reservas/services/checkin-reminders.service'

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
    const [bookings, quoteRequests, checkinReminders] = await Promise.all([
      expireOverduePendingBookings(),
      purgeStaleQuoteRequests(),
      sendCheckinReminders(),
    ])
    return Response.json({ bookings, quoteRequests, checkinReminders }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.'
    return Response.json({ error: message }, { status: 500 })
  }
}
