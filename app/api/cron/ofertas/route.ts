import { timingSafeEqual } from 'node:crypto'
import { sendDueOfferEmails } from '@/features/ofertas/services/offers.service'
import { reportError } from '@/lib/observability/report-error'

/**
 * Rodada diária das ofertas para ex-hóspedes (0111), às 13h UTC (10h de
 * Brasília, dentro da janela das 8h às 21h): manda os e-mails que ficaram na
 * fila (oferta enviada à noite, ou falha de SMTP). Cron próprio porque a
 * rodada de manutenção roda de madrugada, fora do horário de propaganda.
 *
 * Disparada pelo Vercel Cron (ver `vercel.json`) com
 * `Authorization: Bearer <CRON_SECRET>`, como as outras rodadas.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const a = Buffer.from(request.headers.get('authorization') ?? '')
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  try {
    const emails = await sendDueOfferEmails()
    return Response.json({ emails })
  } catch (error) {
    console.error('[cron] ofertas falhou', String(error))
    await reportError(error, { where: 'cron:ofertas' })
    return Response.json({ error: 'Falha inesperada.' }, { status: 500 })
  }
}
