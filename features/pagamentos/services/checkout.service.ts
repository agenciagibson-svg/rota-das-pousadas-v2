import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getBookingForCheckout } from '@/repositories/bookings.repository'
import { getPousadaPaymentContextForWebhook } from '@/repositories/payments.repository'
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

  if (booking.balanceDue <= 0) throw new Error('Esta reserva não possui saldo a pagar.')
  // A propriedade da reserva foi conferida acima via sessão/RLS. Tokens não são
  // legíveis pelo viajante; apenas esta RPC server-only obtém o contexto mínimo.
  const account = await getPousadaPaymentContextForWebhook(booking.id)
  if (!account?.accessTokenEncrypted || account.pousadaId !== booking.pousadaId) {
    throw new Error('Esta pousada ainda não está apta a receber pagamentos.')
  }
  const sellerAccessToken = decryptToken(account.accessTokenEncrypted)

  const notificationUrl = `${publicEnv.siteUrl}/api/pagamentos/mercadopago/webhook?bookingId=${booking.id}`
  const returnUrl = `${publicEnv.siteUrl}/minhas-reservas`

  const preference = await createMpPreference({
    sellerAccessToken,
    title: `Reserva ${booking.code}`,
    quantity: 1,
    unitPrice: booking.balanceDue,
    marketplaceFee: Math.round(booking.fee * booking.balanceDue / booking.total * 100) / 100,
    externalReference: booking.id,
    notificationUrl,
    backUrls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
  })

  return { initPoint: preference.init_point }
}
