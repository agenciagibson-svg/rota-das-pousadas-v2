import { z } from 'zod'
import { isStoredImageUrl } from '@/lib/validation/image-url'
import { ufSchema, phoneSchema, cepSchema } from '@/lib/validation/br'
import { isValidTimeZone } from '@/lib/dates'
import { geoPointSchema } from '@/lib/geo/coordinates'
import type { BookingStatus } from '@/features/reservas/types'

/** Ação sobre uma data do calendário, como bloquear ou desbloquear. */
export const dateActionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  /** Quarto específico; sem ele, vale para todos os quartos da pousada. */
  roomId: z.string().uuid().optional(),
})
export type DateActionInput = z.infer<typeof dateActionSchema>

/** Status que a equipe pode aplicar pelo painel (0034 + check-in/check-out da 0048). */
const ownerAllowedStatuses = [
  'confirmed',
  'cancelled',
  'no_show',
  'checked_in',
  'checked_out',
] as const satisfies BookingStatus[]

/** Ação de status feita pela equipe da pousada numa reserva. Motivo obrigatório para cancelar/no-show — validado no service e de novo na RPC. */
export const reservationStatusActionSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  status: z.enum(ownerAllowedStatuses),
  reason: z.string().trim().max(500).optional(),
})
export type ReservationStatusActionInput = z.infer<typeof reservationStatusActionSchema>

const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Data inválida.')

/**
 * Mapa de ocupação (0096): mover reserva para outro quarto/datas. O valor nunca
 * vem do cliente — `reprice` só pede ao banco para usar as tarifas.
 */
export const moveBookingSchema = z
  .object({
    bookingId: z.string().uuid('Reserva inválida.'),
    version: z.number().int().min(0),
    roomId: z.string().uuid('Escolha o quarto.'),
    checkin: civilDate,
    checkout: civilDate,
    reprice: z.boolean(),
  })
  .refine((v) => v.checkout > v.checkin, {
    message: 'A data de saída deve ser posterior à de entrada.',
    path: ['checkout'],
  })
export type MoveBookingInput = z.infer<typeof moveBookingSchema>

export const bookingIdActionSchema = z.object({ bookingId: z.string().uuid('Reserva inválida.') })
export type BookingIdActionInput = z.infer<typeof bookingIdActionSchema>

/** Filtros da lista de reservas administrativa (seção 15) — todos opcionais, vindos de searchParams. */
export type GestaoReservationFilters = {
  status?: BookingStatus
  origin?: string
  roomId?: string
  guestName?: string
  pendingPaymentOnly?: boolean
  checkinFrom?: string
  checkinTo?: string
}

/** Resposta pública do proprietário a uma avaliação. */
export const reviewResponseActionSchema = z.object({
  reviewId: z.string().uuid('Avaliação inválida.'),
  response: z
    .string()
    .trim()
    .min(3, 'Escreva uma resposta.')
    .max(1000, 'A resposta deve ter no máximo 1000 caracteres.'),
})
export type ReviewResponseActionInput = z.infer<typeof reviewResponseActionSchema>

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

/** Imagem da pousada: vazio, caminho do próprio site ou URL http(s) (ver `isStoredImageUrl`). */
const isPousadaImage = (value: string) => isStoredImageUrl(value)

export const pousadaSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(120, 'Nome muito longo.'),
  legalName: z.string().trim().max(160, 'Razão social muito longa.'),
  taxId: z.string().trim().max(30, 'Documento fiscal muito longo.'),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80, 'Cidade muito longa.'),
  state: ufSchema.transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2, 'Informe o país.').max(60, 'País muito longo.'),
  address: z.string().trim().max(200, 'Endereço muito longo.'),
  cep: cepSchema.or(z.literal('')),
  image: z
    .string()
    .trim()
    .max(2048, 'Endereço de imagem muito longo.')
    .refine(isPousadaImage, 'Informe uma URL (https://...) ou um caminho do site (/...).'),
  /** Todas as fotos da vitrine, a capa primeiro (a capa também fica em `image`). */
  gallery: z
    .array(z.string().trim().min(1).max(2048).refine(isPousadaImage, 'Foto inválida.'))
    .max(20, 'Use no máximo 20 fotos.'),
  description: z.string().trim().min(20, 'Descreva melhor a pousada.').max(1500),
  tags: z.string().trim().max(160, 'Use no máximo 160 caracteres.'),
  // O fuso define o "hoje" do painel, das reservas pelo site e do check-in;
  // texto livre ("Brasília") o banco não reconhece.
  timezone: z
    .string()
    .trim()
    .min(2, 'Informe o fuso horário.')
    .max(60)
    .refine(isValidTimeZone, 'Fuso inválido. Use o nome oficial, como America/Sao_Paulo.'),
  currency: z
    .string()
    .trim()
    .length(3, 'Use o código de 3 letras (ex.: BRL).')
    .transform((v) => v.toUpperCase()),
  language: z.string().trim().min(2, 'Informe o idioma.').max(10),
  checkinTime: z.string().regex(timeRegex, 'Horário inválido.'),
  checkoutTime: z.string().regex(timeRegex, 'Horário inválido.'),
  contactPhone: phoneSchema.or(z.literal('')),
  whatsapp: phoneSchema.or(z.literal('')),
  notificationEmail: z.string().trim().email('E-mail inválido.').or(z.literal('')),
  houseRules: z.string().trim().max(1500, 'Regras muito longas.'),
  cancellationPolicy: z.string().trim().max(1500, 'Política muito longa.'),
})
export type PousadaSettingsInput = z.infer<typeof pousadaSettingsSchema>

/** Ponto da pousada no mapa (0095). `null` apaga o ponto. */
export const pousadaLocationSchema = z.object({ location: geoPointSchema.nullable() }).strict()
export type PousadaLocationInput = z.infer<typeof pousadaLocationSchema>

/** "Buscar pelo endereço" não recebe nada do navegador: usa o endereço salvo. */
export const geocodeAddressActionSchema = z.object({}).strict()
