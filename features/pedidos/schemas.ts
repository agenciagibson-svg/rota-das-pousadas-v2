import { z } from 'zod'
import {
  parseAgenda,
  parseEmergency,
  parseFacilities,
  parseLocalTips,
} from '@/features/estadia/info'

export const orderLinesSchema = z
  .array(
    z.object({
      itemId: z.string().uuid('Item inválido.'),
      quantity: z.coerce.number().int().min(1, 'Quantidade inválida.').max(20, 'Máximo de 20.'),
    }),
  )
  .min(1, 'Escolha pelo menos um item.')
  .max(20, 'Máximo de 20 itens por pedido.')

export const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['preparando', 'entregue', 'cancelado']),
  reason: z.string().trim().max(200).optional(),
})

export const chargeSchema = z.object({
  bookingId: z.string().uuid('Escolha a reserva.'),
  items: orderLinesSchema,
  note: z.string().trim().max(300).default(''),
})

export const consumptionPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce
    .number({ invalid_type_error: 'Informe o valor.' })
    .positive('Informe o valor.')
    .max(100_000),
  method: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'outro']),
  note: z.string().trim().max(200).default(''),
})

/** Lista "uma por linha" do formulário → array validado (erro aponta a linha). */
function listField<T>(
  parse: (text: string) => { ok: true; items: T[] } | { ok: false; error: string },
) {
  return z
    .string()
    .max(4000, 'Texto muito longo.')
    .default('')
    .transform((text, ctx) => {
      const r = parse(text)
      if (!r.ok) {
        ctx.addIssue({ code: 'custom', message: r.error })
        return z.NEVER
      }
      return r.items
    })
}

export const guestSettingsSchema = z.object({
  wifiName: z.string().trim().max(80, 'Nome muito longo.'),
  wifiPassword: z.string().trim().max(80, 'Senha muito longa.'),
  guestInfo: z.string().trim().max(2000, 'Use no máximo 2000 caracteres.'),
  ordersEnabled: z.boolean(),
  ordersHours: z.string().trim().max(120, 'Use no máximo 120 caracteres.'),
  breakfastInfo: z.string().trim().max(200, 'Use no máximo 200 caracteres.').default(''),
  parkingInfo: z.string().trim().max(200, 'Use no máximo 200 caracteres.').default(''),
  facilities: listField(parseFacilities),
  dailyAgenda: listField(parseAgenda),
  localTips: listField(parseLocalTips),
  emergency: listField(parseEmergency),
})

// App do hóspede
export const placeOrderSchema = z.object({
  bookingId: z.string().uuid(),
  items: orderLinesSchema,
  note: z.string().trim().max(300, 'Use no máximo 300 caracteres.').default(''),
})
export const cancelOrderSchema = z.object({ orderId: z.string().uuid() })
export const stayQuerySchema = z.object({ bookingId: z.string().uuid() })
export const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, 'Escolha de 1 a 5 estrelas.').max(5),
  text: z.string().trim().max(1000, 'Use no máximo 1000 caracteres.').default(''),
})
