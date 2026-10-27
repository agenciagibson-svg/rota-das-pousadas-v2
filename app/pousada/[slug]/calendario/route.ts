import { NextResponse, type NextRequest } from 'next/server'
import { priceCalendarQuerySchema } from '@/features/reservas/schemas'
import { getPriceCalendar } from '@/server/queries'
import { reportError } from '@/lib/observability/report-error'

export const dynamic = 'force-dynamic'

/**
 * Calendário com preço (0094) para o seletor de datas da página da pousada e
 * da reserva: `?mes=AAAA-MM&hospedes=2&quarto=<uuid>` → noites do mês com a
 * diária "a partir de", se há vaga e a estadia mínima.
 *
 * Público como a vitrine: a RPC só responde para pousada publicada e não
 * devolve nada de reserva ou hóspede. Cache curto no navegador — a vaga muda.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const parsed = priceCalendarQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )
  if (!parsed.success || slug.length > 200) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const { mes, hospedes, quarto } = parsed.data
  try {
    const days = await getPriceCalendar(slug, mes, hospedes, quarto)
    return NextResponse.json(
      { month: mes, days },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (error) {
    await reportError(error, { where: 'route', route: '/pousada/[slug]/calendario' })
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
