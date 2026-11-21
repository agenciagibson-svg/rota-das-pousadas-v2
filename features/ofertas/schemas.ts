import { z } from 'zod'
import {
  OFFER_PERCENT_MAX,
  OFFER_PERCENT_MIN,
  OFFER_VALID_DAYS_DEFAULT,
  OFFER_VALID_DAYS_MAX,
  OFFER_VALID_DAYS_MIN,
} from './rules'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .optional()
  .or(z.literal('').transform(() => undefined))

export const sendOfferSchema = z
  .object({
    percent: z.coerce
      .number()
      .int()
      .min(OFFER_PERCENT_MIN, `O desconto vai de ${OFFER_PERCENT_MIN}% a ${OFFER_PERCENT_MAX}%.`)
      .max(OFFER_PERCENT_MAX, `O desconto vai de ${OFFER_PERCENT_MIN}% a ${OFFER_PERCENT_MAX}%.`),
    validDays: z.coerce
      .number()
      .int()
      .min(
        OFFER_VALID_DAYS_MIN,
        `A validade vai de ${OFFER_VALID_DAYS_MIN} a ${OFFER_VALID_DAYS_MAX} dias.`,
      )
      .max(
        OFFER_VALID_DAYS_MAX,
        `A validade vai de ${OFFER_VALID_DAYS_MIN} a ${OFFER_VALID_DAYS_MAX} dias.`,
      )
      .default(OFFER_VALID_DAYS_DEFAULT),
    stayFrom: isoDate,
    stayUntil: isoDate,
    message: z.string().trim().max(200, 'Use no máximo 200 caracteres.').default(''),
  })
  .refine((v) => !v.stayFrom || !v.stayUntil || v.stayUntil > v.stayFrom, {
    message: 'O período da estadia precisa terminar depois de começar.',
    path: ['stayUntil'],
  })
export type SendOfferData = z.infer<typeof sendOfferSchema>

export const offerConsentSchema = z.object({
  pousadaId: z.string().uuid(),
  granted: z.boolean(),
})

const autoOffer = z.object({
  on: z.boolean(),
  percent: z.coerce.number().int().min(OFFER_PERCENT_MIN).max(OFFER_PERCENT_MAX),
})
export const autoOffersSchema = z.object({
  seisMeses: autoOffer,
  aniversario: autoOffer,
  feriado: autoOffer,
})
