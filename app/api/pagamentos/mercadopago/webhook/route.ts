import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyWebhookSignature, processPaymentNotification } from '@/features/pagamentos/services/webhook.service'

const notificationSchema = z.object({
  type: z.string(),
  data: z.object({ id: z.union([z.string(), z.number().int().positive().safe()]).transform(String)
    .refine((id) => /^\d{1,40}$/.test(id)) }),
})

/** Só confirma recebimento após persistir; falhas temporárias permitem retry. */
export async function POST(request: NextRequest) {
  const booking = z.string().uuid().safeParse(request.nextUrl.searchParams.get('bookingId'))
  const body = notificationSchema.safeParse(await request.json().catch(() => null))
  if (!booking.success || !body.success) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 })
  }
  const dataId = request.nextUrl.searchParams.get('data.id') ?? body.data.data.id
  if (dataId !== body.data.data.id) {
    return NextResponse.json({ error: 'invalid_notification' }, { status: 400 })
  }
  try {
    const isValid = verifyWebhookSignature({
      xSignatureHeader: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'), dataId,
    })
    if (!isValid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    if (body.data.type !== 'payment') return NextResponse.json({ ignored: true })
    await processPaymentNotification({ bookingId: booking.data, mpPaymentId: dataId })
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[mercadopago:webhook] processamento falhou', { bookingId: booking.data, dataId })
    return NextResponse.json({ error: 'processing_failed' }, { status: 503 })
  }
}
