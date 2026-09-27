import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, getBookingCheckout } from '@/server/queries'

export const dynamic = 'force-dynamic'

/**
 * Único jeito de chegar ao checkout do Mercado Pago. O link de pagamento é
 * criado AQUI, na hora do clique, e só para o hóspede logado dono da reserva
 * (`createCheckoutPreference` confere sessão + dono via RLS). A página de
 * pagamento nunca expõe o link do Mercado Pago no HTML.
 *
 * - Sem login → vai para o login e volta para a página de pagamento.
 * - Reserva de outra pessoa, paga, vencida ou pousada sem conta → volta para
 *   a página de pagamento, que explica a situação.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params
  const pagePath = `/pousada/${encodeURIComponent(slug)}/reservar/${encodeURIComponent(id)}/pagamento`
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url), 303)
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  const user = await getCurrentUser()
  if (!user) return to(`/login?next=${encodeURIComponent(pagePath)}`)
  if (!z.string().uuid().safeParse(id).success) return to('/minhas-reservas')

  try {
    const { initPoint } = await getBookingCheckout(id)
    const target = new URL(initPoint)
    if (!/(^|\.)mercadopago\.com(\.br)?$/.test(target.hostname))
      throw new Error('Destino inválido.')
    const res = NextResponse.redirect(target, 303)
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch {
    return to(`${pagePath}?erro=pagamento`)
  }
}
