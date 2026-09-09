import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getBookingForCheckout } from '@/repositories/bookings.repository'
import { getPaymentAccountByPousada } from '@/repositories/payment-accounts.repository'
import { decryptToken } from '@/lib/crypto/token-cipher'
import { publicEnv } from '@/lib/env'
import { createCheckoutPreference as createMpPreference } from './mp-client'

/**
 * Cria a preferência de checkout (Checkout Pro) do Mercado Pago usando o
 * token da PRÓPRIA pousada — o dinheiro vai direto para ela, a plataforma só
 * recebe `marketplace_fee` (já calculado em `bookings.fee`, 8% — ver
 * features/reservas/pricing.ts). O `bookingId` vai como query param no
 * `notification_url` para o webhook saber de qual pousada é o token antes
 * mesmo de reconsultar o pagamento na API do Mercado Pago.
 */
export async function createCheckoutPreference(bookingId: string): Promise<{ initPoint: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para continuar.')

  const booking = await getBookingForCheckout(bookingId, user.id)
  if (!booking) throw new Error('Reserva não encontrada.')
  if (booking.status !== 'pending') {
    throw new Error('Esta reserva não está aguardando pagamento.')
  }

  const account = await getPaymentAccountByPousada(booking.pousadaId)
  if (!account?.accessToken) {
    throw new Error('Esta pousada ainda não está apta a receber pagamentos.')
  }
  const sellerAccessToken = decryptToken(account.accessToken)

  const notificationUrl = `${publicEnv.siteUrl}/api/pagamentos/mercadopago/webhook?bookingId=${booking.id}`
  const returnUrl = `${publicEnv.siteUrl}/minhas-reservas`

  const preference = await createMpPreference({
    sellerAccessToken,
    title: `Reserva ${booking.code}`,
    quantity: 1,
    unitPrice: booking.total,
    marketplaceFee: booking.fee,
    externalReference: booking.id,
    notificationUrl,
    backUrls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
  })

  return { initPoint: preference.init_point }
}
