import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebhookSignature, processPaymentNotification } from '@/features/pagamentos/services/webhook.service'

/**
 * Webhook do Mercado Pago. `bookingId` vem do `notification_url` que a
 * própria plataforma definiu ao criar a preferência (checkout.service.ts) —
 * é o que permite saber de qual pousada é o token antes de reconsultar o
 * pagamento. Sempre responde 200 rápido (mesmo em erro interno, já logado)
 * para não entrar em loop de retry do Mercado Pago; só responde diferente de
 * 200 quando a ASSINATURA não bate, porque aí a notificação nem é confiável
 * o bastante para tentar processar.
 */
export async function POST(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('bookingId')
  const body = (await request.json().catch(() => null)) as { type?: string; data?: { id?: string } } | null

  const dataId = body?.data?.id
  if (!bookingId || !dataId) {
    return NextResponse.json({ ignored: true }, { status: 200 })
  }

  const isValid = verifyWebhookSignature({
    xSignatureHeader: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId,
  })
  if (!isValid) {
    console.error('[mercadopago:webhook] assinatura inválida', { bookingId, dataId })
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  if (body?.type !== 'payment') {
    return NextResponse.json({ ignored: true }, { status: 200 })
  }

  try {
    await processPaymentNotification({ bookingId, mpPaymentId: dataId })
  } catch (error) {
    console.error('[mercadopago:webhook]', error)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
