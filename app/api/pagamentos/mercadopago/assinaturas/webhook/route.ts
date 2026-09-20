import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyWebhookSignature } from '@/features/pagamentos/services/webhook.service'
import {
  processSubscriptionPreapprovalNotification,
  processSubscriptionAuthorizedPaymentNotification,
} from '@/features/pagamentos/services/subscription.service'

/**
 * Webhook da assinatura da PLATAFORMA (Mercado Pago Assinaturas) — diferente
 * do webhook de pagamento de hóspede (`.../mercadopago/webhook`, que exige
 * `bookingId` na query string): aqui não há reserva nenhuma envolvida, só a
 * cobrança recorrente da pousada. Mesma verificação de assinatura HMAC
 * (`verifyWebhookSignature`) — é a MESMA conta/aplicação Mercado Pago que
 * recebe as duas notificações, então o segredo (`MERCADO_PAGO_WEBHOOK_SECRET`)
 * é compartilhado; o que muda é `type`/`data.id` no corpo.
 *
 * ⚠️ `type` aceito ainda não foi validado contra uma notificação real do
 * Mercado Pago para Assinaturas — revalidar (`subscription_preapproval` e
 * `subscription_authorized_payment` conferidos na documentação oficial em
 * 2026-09) antes de operar em produção.
 */
const notificationSchema = z.object({
  type: z.enum(['subscription_preapproval', 'subscription_authorized_payment']),
  data: z.object({
    id: z
      .union([z.string(), z.number().int().positive().safe()])
      .transform(String)
      .refine((id) => /^[\w-]{1,60}$/.test(id)),
  }),
})

export async function POST(request: NextRequest) {
  const body = notificationSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
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

    if (body.data.type === 'subscription_preapproval') {
      await processSubscriptionPreapprovalNotification(dataId)
    } else {
      await processSubscriptionAuthorizedPaymentNotification(dataId)
    }
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[mercadopago:assinaturas:webhook] processamento falhou', {
      type: body.data.type,
      dataId,
    })
    return NextResponse.json({ error: 'processing_failed' }, { status: 503 })
  }
}
