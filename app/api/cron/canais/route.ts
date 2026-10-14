import { timingSafeEqual } from 'node:crypto'
import { syncAllFeeds } from '@/features/canais/services/sync.service'
import { reportError } from '@/lib/observability/report-error'

/**
 * Rodada de importação dos calendários das OTAs.
 *
 * Disparada pelo Vercel Cron (ver `vercel.json`), que envia
 * `Authorization: Bearer <CRON_SECRET>`. Sem o segredo correto a rota responde
 * 401 — ela não é pública, ainda que não faça nada destrutivo: um terceiro
 * disparando a rodada em laço viraria martelo contra a API das OTAs, e o IP
 * bloqueado seria o da pousada.
 */
export const dynamic = 'force-dynamic'
/** Uma pousada com muitos quartos leva mais que os 10s padrão. */
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
    const report = await syncAllFeeds()
    // 200 mesmo com canais em falha: a rodada em si funcionou, e o erro de cada
    // canal fica gravado no próprio canal para aparecer na tela da pousada.
    // Devolver 500 aqui faria a Vercel reportar o cron como quebrado quando o
    // problema é o feed de um cliente.
    return Response.json(report, { status: 200 })
  } catch (error) {
    // Detalhe só no log e no Sentry — a resposta não devolve mensagem técnica.
    console.error('[cron] canais falhou', error instanceof Error ? error.message : String(error))
    await reportError(error, { where: 'cron:canais' })
    return Response.json({ error: 'Falha inesperada.' }, { status: 500 })
  }
}
