import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  NoPaymentAccountError,
  verifyWebhookSignature,
  processPaymentNotification,
} from '@/features/pagamentos/services/webhook.service'
import { notifyPaymentReviews } from '@/features/pagamentos/services/pix.service'
import { reportError } from '@/lib/observability/report-error'

const notificationSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z
      .union([z.string(), z.number().int().positive().safe()])
      .transform(String)
      .refine((id) => /^\d{1,40}$/.test(id)),
  }),
})

/** Só confirma recebimento após persistir; falhas temporárias permitem retry. */
export async function POST(request: NextRequest) {
  const booking = z.string().uuid().safeParse(request.nextUrl.searchParams.get('bookingId'))
  const raw: unknown = await request.json().catch(() => null)
  const body = notificationSchema.safeParse(raw)
  if (!booking.success) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 })
  }
  // O Mercado Pago também manda o formato antigo (IPN: `topic`/`resource`,
  // inclusive `merchant_order`). Não precisamos dele — o aviso `type=payment`
  // chega em paralelo — então confirmamos o recebimento para não gerar retries.
  if (!body.success) {
    if (isLegacyIpn(raw)) return NextResponse.json({ ignored: true })
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 })
  }
  const dataId = request.nextUrl.searchParams.get('data.id') ?? body.data.data.id
  if (dataId !== body.data.data.id) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 })
  }
  try {
    const isValid = verifyWebhookSignature({
      xSignatureHeader: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId,
    })
    if (!isValid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    if (body.data.type !== 'payment') return NextResponse.json({ ignored: true })
    await processPaymentNotification({ bookingId: booking.data, mpPaymentId: dataId })
    // Pagamento que caiu em reserva cancelada/estornado entra na fila (0082): avisa já.
    await notifyPaymentReviews()
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Assinatura já conferida: sem conta conectada não há o que reprocessar.
    if (error instanceof NoPaymentAccountError) {
      console.warn('[mercadopago:webhook] reserva sem conta conectada — aviso ignorado', {
        bookingId: booking.data,
        dataId,
      })
      return NextResponse.json({ ignored: true })
    }
    console.error('[mercadopago:webhook] processamento falhou', {
      bookingId: booking.data,
      dataId,
      reason: error instanceof Error ? error.message.slice(0, 300) : 'erro desconhecido',
    })
    await reportError(error, { where: 'webhook:mercadopago' })
    return NextResponse.json({ error: 'processing_failed' }, { status: 503 })
  }
}

/** Formato IPN antigo: `{ resource, topic }`, sem o bloco `data`. */
function isLegacyIpn(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  return typeof obj.topic === 'string' && !('data' in obj)
}
