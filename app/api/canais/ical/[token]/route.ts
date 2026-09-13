import { buildICalendar } from '@/features/canais/ical'
import { getExportFeedByToken } from '@/repositories/channels.repository'

/**
 * Feed iCal que a Rota publica para a OTA ler.
 *
 * Sem sessão: a autorização é o token da própria URL, resolvido por uma RPC
 * `security definer` concedida só a `service_role` (0044). Token inválido,
 * curto ou de canal com exportação desligada devolve 404 — a resposta não
 * distingue os casos, para não virar oráculo de tokens válidos.
 *
 * O conteúdo tem só período e rótulo genérico. Nome, telefone, e-mail e valor
 * do hóspede nunca entram aqui: esta URL é colada na extranet da OTA e vive
 * fora de qualquer controle nosso.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params

  let feed: Awaited<ReturnType<typeof getExportFeedByToken>>
  try {
    feed = await getExportFeedByToken(token)
  } catch {
    // Falha de infraestrutura não deve devolver calendário vazio: a OTA leria
    // "nada ocupado" e voltaria a vender datas já vendidas aqui.
    return new Response('Calendário indisponível no momento.', { status: 503 })
  }

  if (!feed) return new Response('Calendário não encontrado.', { status: 404 })

  const body = buildICalendar({ roomName: feed.roomName, events: feed.events })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="rota-das-pousadas.ics"',
      // As OTAs releem o feed em ciclo próprio; cache curto evita que uma
      // reserva feita agora demore a aparecer lá.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
