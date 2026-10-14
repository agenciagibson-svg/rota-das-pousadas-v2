import { z } from 'zod'

/** Formas de pagamento da diária que a equipe registra no painel (0086). */
export const MANUAL_PAYMENT_METHODS = [
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'transferencia',
  'outro',
] as const

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export const MANUAL_PAYMENT_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  transferencia: 'Transferência',
  outro: 'Outro',
}

/** Rótulo de qualquer forma gravada em `payments.method` (manual, Pix direto, Mercado Pago). */
export function bookingPaymentMethodLabel(method: string): string {
  if (method.startsWith('manual_')) {
    const key = method.slice('manual_'.length) as ManualPaymentMethod
    return MANUAL_PAYMENT_METHOD_LABEL[key] ?? 'Outro'
  }
  if (method === 'pix_direto') return 'Pix (comprovante)'
  if (method === 'pix') return 'Pix (Mercado Pago)'
  if (method.includes('card') || method.includes('credit') || method.includes('debit')) {
    return 'Cartão (Mercado Pago)'
  }
  return 'Mercado Pago'
}

export const registerBookingPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce
    .number({ invalid_type_error: 'Informe o valor.' })
    .positive('Informe o valor recebido.')
    .max(1_000_000),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  note: z.string().trim().max(200).default(''),
})

export const reverseBookingPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  paymentId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, 'Informe o motivo do estorno.')
    .max(190, 'Use no máximo 190 caracteres.'),
})
