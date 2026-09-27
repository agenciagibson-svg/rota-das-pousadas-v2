import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { decryptToken } from '@/lib/crypto/token-cipher'
import {
  getPousadaPaymentContextForWebhook,
  recordPaymentAndConfirmBookingRpc,
  type PaymentStatus,
} from '@/repositories/payments.repository'
import { getBookingNotificationContextRpc } from '@/repositories/bookings.repository'
import { sendEmail } from '@/lib/email/mailer'
import { bookingConfirmedEmail } from '@/lib/email/templates'
import { getPaymentById, searchPaymentsByExternalReference, type MpPayment } from './mp-client'

/**
 * Verifica o header `x-signature` do webhook do Mercado Pago.
 *
 * Formato: `ts=<epoch>,v1=<hmac_hex>`. O Mercado Pago envia `ts` em SEGUNDOS
 * (ex.: `ts=1704908010`); aceitamos também milissegundos por robustez. O "manifest" assinado é
 * `id:<data.id, minúsculo>;request-id:<x-request-id>;ts:<ts>;` — conferido
 * na documentação oficial em 2026-09. Revalidar se o Mercado Pago mudar o
 * esquema antes de operar em produção.
 *
 * Além do HMAC, exige `ts` recente (`WEBHOOK_MAX_CLOCK_SKEW_MS`): sem isso,
 * uma notificação capturada (log de proxy, extensão de navegador no painel
 * do Mercado Pago) continuaria com assinatura válida para sempre e poderia
 * ser reenviada manualmente. O impacto de um replay já era limitado —
 * `processPaymentNotification` sempre reconsulta o pagamento de verdade na
 * API do Mercado Pago antes de gravar, nunca confia no corpo — mas rejeitar
 * `ts` velho fecha a reexecução gratuita sem custo nenhum de UX (o Mercado
 * Pago reenvia no mesmo segundo do evento).
 */
const WEBHOOK_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

export function verifyWebhookSignature(params: {
  xSignatureHeader: string | null
  xRequestId: string | null
  dataId: string
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) throw new Error('MERCADO_PAGO_WEBHOOK_SECRET não configurada.')
  if (!params.xSignatureHeader || !params.xRequestId) return reject('missing_headers')

  const parts = Object.fromEntries(
    params.xSignatureHeader.split(',').map((pair) => {
      const [key, value] = pair.split('=')
      return [key?.trim(), value?.trim()]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return reject('malformed_header')

  const tsNum = Number(ts)
  // Segundos (10 dígitos) → ms. Antes comparávamos segundos com Date.now() em
  // ms e TODA notificação real era recusada como "velha" (401).
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > WEBHOOK_MAX_CLOCK_SKEW_MS)
    return reject('stale_ts')

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const a = Buffer.from(v1)
  const b = Buffer.from(expected)
  const ok = a.length === b.length && timingSafeEqual(a, b)
  return ok || reject('hmac_mismatch')
}

/** Loga só o motivo (nunca segredo nem assinatura) para diagnosticar 401. */
function reject(reason: string): false {
  console.warn('[mercadopago:webhook] assinatura recusada', { reason })
  return false
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
export async function processPaymentNotification(params: {
  bookingId: string
  mpPaymentId: string
}): Promise<void> {
  const context = await getPousadaPaymentContextForWebhook(params.bookingId)
  if (!context) {
    throw new Error(
      `Reserva ${params.bookingId} sem conta de pagamento conectada — notificação ignorada.`,
    )
  }

  const sellerAccessToken = decryptToken(context.accessTokenEncrypted)
  const payment = await getPaymentById(params.mpPaymentId, sellerAccessToken)

  if (payment.external_reference !== params.bookingId) {
    throw new Error(
      `Pagamento ${params.mpPaymentId} tem external_reference divergente do bookingId da notificação — possível adulteração.`,
    )
  }
  if (String(payment.id) !== params.mpPaymentId) throw new Error('ID de pagamento divergente.')

  await recordMpPayment(params.bookingId, payment)
}

/**
 * Rede de segurança do webhook: consulta no Mercado Pago os pagamentos desta
 * reserva e grava os aprovados. Chamado quando o hóspede abre "Minhas
 * reservas" / a página de pagamento com a reserva ainda pendente — assim um
 * aviso perdido, atrasado ou recusado nunca deixa uma reserva paga como
 * "Aguardando pagamento". Idempotente (a RPC 0042 distingue repetição) e
 * fail-soft: nunca derruba a página. Devolve true se confirmou algo agora.
 */
export async function reconcileBookingPayments(bookingId: string): Promise<boolean> {
  try {
    const context = await getPousadaPaymentContextForWebhook(bookingId)
    if (!context?.accessTokenEncrypted) return false
    const token = decryptToken(context.accessTokenEncrypted)
    const payments = await searchPaymentsByExternalReference(bookingId, token)
    let confirmed = false
    for (const payment of payments) {
      if (payment.external_reference !== bookingId || payment.status !== 'approved') continue
      if (await recordMpPayment(bookingId, payment)) confirmed = true
    }
    return confirmed
  } catch (error) {
    console.error('[mercadopago:reconcile] falhou', { bookingId, error: String(error) })
    return false
  }
}

/** Grava o pagamento (já reconsultado na API) e avisa o hóspede na 1ª confirmação. */
async function recordMpPayment(bookingId: string, payment: MpPayment): Promise<boolean> {
  const params = { bookingId }
  const result = await recordPaymentAndConfirmBookingRpc({
    bookingId: params.bookingId,
    providerRef: String(payment.id),
    amount: payment.transaction_amount,
    status: mapMpStatus(payment.status),
    method: payment.payment_method_id,
    currency: payment.currency_id,
    updatedAt: payment.date_last_updated,
    refundedAmount: payment.transaction_amount_refunded,
  })

  // `status === 'ok'` é a ÚNICA vez que esta chamada de fato confirmou a
  // reserva agora (0042) — `stale`/`already_recorded` são reentrega do
  // mesmo webhook pelo Mercado Pago; sem essa checagem o hóspede receberia
  // o e-mail de confirmação de novo a cada reenvio (0060).
  if (result.status === 'ok') {
    await notifyBookingConfirmed(params.bookingId)
    return true
  }
  return false
}

/**
 * Envia o e-mail de confirmação/"ticket" (0060). Fail-soft: nunca deve
 * derrubar o webhook — o pagamento já foi gravado nesse ponto.
 */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  try {
    const ctx = await getBookingNotificationContextRpc(bookingId)
    if (!ctx || !ctx.guestEmail) return
    const { subject, html, text } = bookingConfirmedEmail(ctx)
    await sendEmail({ to: ctx.guestEmail, subject, html, text })
  } catch (error) {
    console.error(`[email] Falha ao notificar confirmação da reserva ${bookingId}:`, error)
  }
}
