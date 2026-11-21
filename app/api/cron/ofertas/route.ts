import { timingSafeEqual } from 'node:crypto'
import { runAutoOffers, sendDueOfferEmails } from '@/features/ofertas/services/offers.service'
import { reportError } from '@/lib/observability/report-error'

/**
 * Rodada diária das ofertas para ex-hóspedes (0111), às 13h UTC (10h de
 * Brasília, dentro da janela das 8h às 21h): cria as ofertas automáticas do
 * dia (0112) e manda os e-mails da fila (automáticas, oferta enviada à noite
 * ou falha de SMTP). Cron próprio porque a
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
    // Primeiro as automáticas de hoje (0112); falha nelas não segura a fila.
    const auto = await runAutoOffers().catch(async (error) => {
      console.error('[cron] ofertas automáticas falharam', String(error))
      await reportError(error, { where: 'cron:ofertas-automaticas' })
      return { error: 'falhou' as const }
    })
    const emails = await sendDueOfferEmails()
    return Response.json({ auto, emails }, { status: 'error' in auto ? 500 : 200 })
  } catch (error) {
    console.error('[cron] ofertas falhou', String(error))
    await reportError(error, { where: 'cron:ofertas' })
    return Response.json({ error: 'Falha inesperada.' }, { status: 500 })
  }
}
