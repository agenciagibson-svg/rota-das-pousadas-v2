import { timingSafeEqual } from 'node:crypto'
import { expireOverduePendingBookings } from '@/features/reservas/services/expire-overdue.service'

/**
 * Rodada de expiração automática de pré-reservas vencidas.
 *
 * Disparada pelo Vercel Cron (ver `vercel.json`), que envia
 * `Authorization: Bearer <CRON_SECRET>` — mesmo segredo e mesmo padrão de
 * `/api/cron/canais`. Sem o segredo correto a rota responde 401.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

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
    const report = await expireOverduePendingBookings()
    return Response.json(report, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.'
    return Response.json({ error: message }, { status: 500 })
  }
}
