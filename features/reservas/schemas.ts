import { z } from 'zod'
import { phoneSchema } from '@/lib/validation/br'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

/** Validação de criação de reserva PÚBLICA (client + server) — layout preservado do Ciclo 1. */
export const createBookingSchema = z
  .object({
    pousadaSlug: z.string().min(1, 'Pousada inválida.'),
    expectedNightly: z.number().nonnegative().optional(),
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
  .refine((d) => d.checkin >= new Date().toISOString().slice(0, 10), {
    message: 'A data de entrada não pode ser no passado.',
    path: ['checkin'],
  })

export type CreateBookingInput = z.infer<typeof createBookingSchema>

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

export const companionSchema = z.object({
  guestId: z.string().uuid().optional(),
  fullName: z.string().trim().min(1, 'Informe o nome.'),
  guestType: z.enum(['responsible', 'adult', 'child', 'infant']),
  hasSpecialNeeds: z.boolean(),
  birthDate: z.string().trim().optional().or(z.literal('')),
  documentType: z.string().trim().optional().or(z.literal('')),
  documentNumber: z.string().trim().optional().or(z.literal('')),
  operationalNotes: z.string().trim().max(500).optional().or(z.literal('')),
})

export const setBookingCompanionsSchema = z.object({
  bookingId: z.string().uuid(),
  version: z.number().int(),
  companions: z.array(companionSchema).min(1, 'Informe ao menos o responsável.'),
})
export type SetBookingCompanionsInput = z.infer<typeof setBookingCompanionsSchema>
