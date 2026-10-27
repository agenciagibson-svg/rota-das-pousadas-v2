import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser, getMyBookingIcs } from '@/server/queries'
import { reportError } from '@/lib/observability/report-error'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * "Adicionar à agenda" (h9): baixa o .ics da reserva. Mesma regra de acesso da
 * ficha de pré-check-in: login obrigatório (proxy + aqui) e reserva que não é
 * do usuário logado responde 404, igual a uma que não existe.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', `/minhas-reservas/${encodeURIComponent(id)}/agenda.ics`)
    return NextResponse.redirect(login, 303)
  }
  if (!UUID.test(id)) return new NextResponse('Reserva não encontrada.', { status: 404 })

  try {
    const file = await getMyBookingIcs(id)
    if (!file) return new NextResponse('Reserva não encontrada.', { status: 404 })
    return new NextResponse(file.content, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    await reportError(error, { where: 'route', route: '/minhas-reservas/[id]/agenda.ics' })
    return new NextResponse('Não foi possível gerar o arquivo agora.', { status: 503 })
  }
}
