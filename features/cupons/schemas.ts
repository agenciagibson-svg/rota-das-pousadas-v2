import { z } from 'zod'
import { COUPON_CODE_RE, normalizeCouponCode } from './discount'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
const optionalDate = isoDate.optional().or(z.literal('').transform(() => undefined))

/** Código digitado: tira espaços das pontas e passa para maiúsculas. */
const couponCode = z
  .string()
  .transform(normalizeCouponCode)
  .refine((v) => COUPON_CODE_RE.test(v), 'Use de 3 a 20 letras ou números, sem espaço nem acento.')

/** Novo cupom no painel (0100). O banco repete todas as checagens. */
export const createCouponSchema = z
  .object({
    code: couponCode,
    kind: z.enum(['percent', 'fixed']),
    value: z.coerce
      .number({ invalid_type_error: 'Informe o desconto.' })
      .int('Use um número inteiro.'),
    validFrom: optionalDate,
    validUntil: optionalDate,
    stayFrom: optionalDate,
    stayUntil: optionalDate,
    minNights: z.coerce
      .number()
      .int()
      .min(1, 'Mínimo de 1 noite.')
      .max(60, 'Até 60 noites.')
      .optional(),
    maxUses: z.coerce.number().int().min(1, 'Pelo menos 1 uso.').max(100000).optional(),
  })
  .refine(
    (v) =>
      v.kind === 'percent' ? v.value >= 1 && v.value <= 90 : v.value >= 1 && v.value <= 100000,
    {
      message: 'Percentual: de 1% a 90%. Valor fixo: de R$ 1 a R$ 100.000.',
      path: ['value'],
    },
  )
  .refine((v) => !v.validFrom || !v.validUntil || v.validUntil >= v.validFrom, {
    message: 'O fim da validade precisa ser depois do início.',
    path: ['validUntil'],
  })
  .refine((v) => !v.stayFrom || !v.stayUntil || v.stayUntil > v.stayFrom, {
    message: 'O período de estadia precisa terminar depois de começar.',
    path: ['stayUntil'],
  })
export type CreateCouponInput = z.input<typeof createCouponSchema>
export type CreateCouponData = z.output<typeof createCouponSchema>

export const couponToggleSchema = z.object({
  id: z.string().uuid('Cupom inválido.'),
  on: z.boolean(),
})
export type CouponToggleInput = z.infer<typeof couponToggleSchema>

/** Prévia do desconto na reserva pública. */
export const previewCouponSchema = z
  .object({
    roomId: z.string().uuid('Escolha a acomodação.'),
    checkin: isoDate,
    checkout: isoDate,
    code: z.string().max(40).transform(normalizeCouponCode),
  })
  .refine((v) => v.checkout > v.checkin, {
    message: 'Escolha as datas antes de aplicar o cupom.',
    path: ['checkout'],
  })
export type PreviewCouponInput = z.input<typeof previewCouponSchema>

/** `?cupom=` da URL (vindo da bio): só aceita formato de código; o resto é ignorado. */
export function couponFromParam(value: string | undefined): string | undefined {
  if (!value) return undefined
  const code = normalizeCouponCode(value)
  return COUPON_CODE_RE.test(code) ? code : undefined
}
