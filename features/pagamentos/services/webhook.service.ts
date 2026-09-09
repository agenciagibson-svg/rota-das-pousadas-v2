import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { decryptToken } from '@/lib/crypto/token-cipher'
import {
  getPousadaPaymentContextForWebhook,
  recordPaymentAndConfirmBookingRpc,
  type PaymentStatus,
} from '@/repositories/payments.repository'
import { getPaymentById, type MpPayment } from './mp-client'

/**
 * Verifica o header `x-signature` do webhook do Mercado Pago.
 *
 * Formato: `ts=<epoch_ms>,v1=<hmac_hex>`. O "manifest" assinado é
 * `id:<data.id, minúsculo>;request-id:<x-request-id>;ts:<ts>;` — conferido
 * na documentação oficial em 2026-09. Revalidar se o Mercado Pago mudar o
 * esquema antes de operar em produção.
 */
export function verifyWebhookSignature(params: {
  xSignatureHeader: string | null
  xRequestId: string | null
  dataId: string
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) throw new Error('MERCADO_PAGO_WEBHOOK_SECRET não configurada.')
  if (!params.xSignatureHeader || !params.xRequestId) return false

  const parts = Object.fromEntries(
    params.xSignatureHeader.split(',').map((pair) => {
      const [key, value] = pair.split('=')
      return [key?.trim(), value?.trim()]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const a = Buffer.from(v1)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function mapMpStatus(status: MpPayment['status']): PaymentStatus {
  switch (status) {
    case 'approved':
      return 'aprovado'
    case 'refunded':
    case 'charged_back':
      return 'estornado'
    case 'rejected':
    case 'cancelled':
      return 'recusado'
    default:
      return 'pendente'
  }
}

/**
 * Processa uma notificação já com a assinatura verificada. `bookingId` vem
 * do query param do `notification_url` (ver checkout.service.ts) — é o que
 * permite saber de qual pousada é o token ANTES de reconsultar o pagamento
 * de verdade na API do Mercado Pago (nunca confiar no corpo do webhook).
 */
export async function processPaymentNotification(params: { bookingId: string; mpPaymentId: string }): Promise<void> {
  const context = await getPousadaPaymentContextForWebhook(params.bookingId)
  if (!context) {
    throw new Error(`Reserva ${params.bookingId} sem conta de pagamento conectada — notificação ignorada.`)
  }

  const sellerAccessToken = decryptToken(context.accessTokenEncrypted)
  const payment = await getPaymentById(params.mpPaymentId, sellerAccessToken)

  if (payment.external_reference !== params.bookingId) {
    throw new Error(
      `Pagamento ${params.mpPaymentId} tem external_reference divergente do bookingId da notificação — possível adulteração.`,
    )
  }

  await recordPaymentAndConfirmBookingRpc({
    bookingId: params.bookingId,
    providerRef: String(payment.id),
    amount: Math.round(payment.transaction_amount),
    status: mapMpStatus(payment.status),
    method: payment.payment_method_id,
    raw: payment,
  })
}
