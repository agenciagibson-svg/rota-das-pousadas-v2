import { z } from 'zod'
import { phoneSchema } from '@/lib/validation/br'
import { PUBLIC_STAY_MAX_NIGHTS, isoNightsBetween } from '@/lib/dates'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

/**
 * Origens aceitas na reserva pelo site: a padrão e a de quem chegou pelo link
 * da bio (`?origem=link_bio`), que alimenta o relatório do link (0046). O banco
 * aceita exatamente estas duas no fluxo público (`create_booking`, 0067).
 */
export const PUBLIC_BOOKING_ORIGINS = ['rota_das_pousadas', 'link_bio'] as const

/** Lê `?origem=` da URL: só o link da bio marca a reserva; qualquer outro valor é ignorado. */
export function bioOriginFromParam(value: string | undefined): 'link_bio' | undefined {
  return value === 'link_bio' ? 'link_bio' : undefined
}

/** Validação de criação de reserva PÚBLICA (client + server) — layout preservado do Ciclo 1. */
export const createBookingSchema = z
  .object({
    pousadaSlug: z.string().min(1, 'Pousada inválida.'),
    expectedNightly: z.number().nonnegative().optional(),
    /** Total que a tela mostrou (cotação do servidor, 0087). Se mudou, o hóspede revisa. */
    expectedTotal: z.number().int().nonnegative().optional(),
    /** Acomodação escolhida (ex.: na página da bio). Sem ela, a mais barata disponível. */
    roomId: z.string().uuid().optional(),
    origin: z.enum(PUBLIC_BOOKING_ORIGINS).optional(),
    /**
     * Cupom aplicado na tela (0100). O desconto é calculado e validado no
     * banco (`create_booking_with_coupon`); `expectedDiscount` é só o valor que
     * a pessoa viu — se o banco calcular outro, a reserva não é criada.
     */
    couponCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3,20}$/, 'Cupom inválido.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    expectedDiscount: z.number().int().nonnegative().optional(),
    checkin: isoDate,
    checkout: isoDate,
    guests: z.coerce
      .number({ invalid_type_error: 'Informe o número de hóspedes.' })
      .int()
      .min(1, 'Mínimo de 1 hóspede.')
      .max(20, 'Máximo de 20 hóspedes.'),
  })
  .refine((d) => d.checkout > d.checkin, {
    message: 'A data de saída deve ser posterior à de entrada.',
    path: ['checkout'],
  })
  .refine((d) => isoNightsBetween(d.checkin, d.checkout) <= PUBLIC_STAY_MAX_NIGHTS, {
    message: `Pelo site, a reserva pode ter até ${PUBLIC_STAY_MAX_NIGHTS} noites. Para mais tempo, fale com a pousada.`,
    path: ['checkout'],
  })
  // O "hoje" exato depende do fuso da pousada e quem confere é o banco
  // (`create_booking`, 0067). Aqui só barramos datas claramente passadas: com
  // um dia de folga sobre UTC, nenhum fuso do Brasil perde o dia de hoje — antes,
  // das 21h à meia-noite o site recusava a entrada no mesmo dia.
  .refine((d) => d.checkin >= new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), {
    message: 'A data de entrada não pode ser no passado.',
    path: ['checkin'],
  })

export type CreateBookingInput = z.infer<typeof createBookingSchema>

/**
 * Consulta do calendário com preço (0094): mês, hóspedes e, se a pessoa já
 * escolheu, a acomodação. Usado pela rota `/pousada/[slug]/calendario`.
 */
export const priceCalendarQuerySchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido.'),
  hospedes: z.coerce.number().int().min(1).max(20).catch(1),
  quarto: z.string().uuid().optional().catch(undefined),
})
export type PriceCalendarQuery = z.infer<typeof priceCalendarQuerySchema>

const bookingOrigins = [
  'rota_das_pousadas',
  'site_proprio',
  'whatsapp',
  'telefone',
  'balcao',
  'booking_com',
  'airbnb',
  'expedia',
  'agencia',
  'outro',
  'link_bio',
] as const

/** Consulta de disponibilidade para o wizard administrativo. */
export const availabilityCheckSchema = z
  .object({
    checkin: isoDate,
    checkout: isoDate,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20),
    pets: z.boolean(),
  })
  .refine((d) => d.checkout > d.checkin, {
    message: 'A saída deve ser posterior à entrada.',
    path: ['checkout'],
  })
export type AvailabilityCheckInput = z.infer<typeof availabilityCheckSchema>

/** Criação administrativa (recepção/proprietário) — formulário único dividido por seção. */
export const createBookingAdminSchema = z
  .object({
    roomId: z.string().uuid('Selecione uma acomodação.'),
    checkin: isoDate,
    checkout: isoDate,
    adults: z.coerce.number().int().min(1, 'Informe ao menos 1 adulto.').max(20),
    children: z.coerce.number().int().min(0).max(20),
    infants: z.coerce.number().int().min(0).max(20),
    pets: z.boolean(),
    guestId: z.string().uuid().optional(),
    guestFullName: z.string().trim().min(2, 'Informe o nome do hóspede responsável.'),
    guestEmail: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
    guestPhone: phoneSchema.optional().or(z.literal('')),
    origin: z.enum(bookingOrigins),
    externalChannelName: z.string().trim().optional().or(z.literal('')),
    externalCode: z.string().trim().optional().or(z.literal('')),
    nightlyRate: z.coerce.number().min(0, 'Informe o valor da diária.'),
    discount: z.coerce.number().min(0),
    surcharge: z.coerce.number().min(0),
    servicesAmount: z.coerce.number().min(0),
    expectedArrivalTime: z.string().trim().optional().or(z.literal('')),
    specialRequests: z.string().trim().max(1000).optional().or(z.literal('')),
    internalNotes: z.string().trim().max(2000).optional().or(z.literal('')),
    initialStatus: z.enum(['quote', 'pending', 'confirmed']),
  })
  .refine((d) => d.checkout > d.checkin, {
    message: 'A saída deve ser posterior à entrada.',
    path: ['checkout'],
  })
export type CreateBookingAdminInput = z.infer<typeof createBookingAdminSchema>

/** Edição administrativa — sempre com `version` para concorrência otimista. */
export const updateBookingSchema = z
  .object({
    bookingId: z.string().uuid(),
    version: z.number().int(),
    roomId: z.string().uuid(),
    guestId: z.string().uuid(),
    checkin: isoDate,
    checkout: isoDate,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20),
    infants: z.coerce.number().int().min(0).max(20),
    pets: z.boolean(),
    nightlyRate: z.coerce.number().min(0),
    discount: z.coerce.number().min(0),
    surcharge: z.coerce.number().min(0),
    servicesAmount: z.coerce.number().min(0),
    origin: z.enum(bookingOrigins),
    expectedArrivalTime: z.string().trim().optional().or(z.literal('')),
    specialRequests: z.string().trim().max(1000).optional().or(z.literal('')),
    internalNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .refine((d) => d.checkout > d.checkin, {
    message: 'A saída deve ser posterior à entrada.',
    path: ['checkout'],
  })
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>

export const bookingStatusActionSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  status: z.enum([
    'quote',
    'pending',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'no_show',
  ]),
  reason: z.string().trim().max(500).optional(),
})
export type BookingStatusActionInput = z.infer<typeof bookingStatusActionSchema>

const cancelBookingSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
})
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>
export { cancelBookingSchema }

/** Link da reserva para o acompanhante (0094): o atual ou um novo (`renew`). */
export const shareBookingSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  renew: z.boolean().default(false),
})
export type ShareBookingInput = z.infer<typeof shareBookingSchema>

export const companionSchema = z.object({
  guestId: z.string().uuid().optional(),
  fullName: z.string().trim().min(1, 'Informe o nome.'),
  guestType: z.enum(['responsible', 'adult', 'child', 'infant']),
  hasSpecialNeeds: z.boolean(),
  birthDate: z.string().trim().optional().or(z.literal('')),
  documentType: z.string().trim().optional().or(z.literal('')),
  documentNumber: z.string().trim().max(50, 'Documento muito longo.').optional().or(z.literal('')),
  operationalNotes: z.string().trim().max(500).optional().or(z.literal('')),
})

export const setBookingCompanionsSchema = z.object({
  bookingId: z.string().uuid(),
  version: z.number().int(),
  companions: z.array(companionSchema).min(1, 'Informe ao menos o responsável.'),
})
export type SetBookingCompanionsInput = z.infer<typeof setBookingCompanionsSchema>
