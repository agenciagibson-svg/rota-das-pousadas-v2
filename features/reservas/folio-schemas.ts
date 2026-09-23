import { z } from 'zod'
import { MANUAL_PAYMENT_METHODS } from './folio'

/** Valor em reais com no máximo dois decimais (o banco guarda numeric(14,2)). */
function money(max: number, label: string) {
  return z.coerce
    .number({ invalid_type_error: `Informe o ${label}.` })
    .positive(`Informe o ${label}.`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} muito alto.`)
    .refine(
      (value) => /^\d+(\.\d{1,2})?$/.test(String(value)),
      'Use no máximo dois decimais (centavos).',
    )
}

const reason = z.string().trim().min(3, 'Informe o motivo.').max(300, 'Motivo muito longo.')

export const addChargeSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  description: z
    .string()
    .trim()
    .min(1, 'Descreva o consumo.')
    .max(120, 'Use no máximo 120 caracteres.'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Informe a quantidade.' })
    .int('Quantidade inteira.')
    .min(1, 'Quantidade mínima de 1.')
    .max(999, 'Quantidade máxima de 999.'),
  unitPrice: money(100_000, 'valor unitário'),
})
export type AddChargeInput = z.infer<typeof addChargeSchema>

export const cancelChargeSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  chargeId: z.string().uuid('Lançamento inválido.'),
  reason,
})
export type CancelChargeInput = z.infer<typeof cancelChargeSchema>

export const registerPaymentSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  method: z.enum(MANUAL_PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Escolha a forma de pagamento.' }),
  }),
  amount: money(10_000_000, 'valor'),
  notes: z.string().trim().max(300, 'Observação muito longa.').optional().or(z.literal('')),
})
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>

export const reversePaymentSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  paymentId: z.string().uuid('Pagamento inválido.'),
  reason,
})
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>
