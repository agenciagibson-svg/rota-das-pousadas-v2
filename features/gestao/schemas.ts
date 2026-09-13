import { z } from 'zod'
import { ufSchema, phoneSchema, cepSchema } from '@/lib/validation/br'
import type { BookingStatus } from '@/features/reservas/types'

/** Ação sobre uma data do calendário, como bloquear ou desbloquear. */
export const dateActionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
})
export type DateActionInput = z.infer<typeof dateActionSchema>

/** [Ciclo 4] Só transições pré-check-in — check-in/checkout ficam para o Ciclo 6. */
const ownerAllowedStatuses = ['confirmed', 'cancelled', 'no_show'] as const satisfies BookingStatus[]

/** Ação de status feita pela equipe da pousada numa reserva. Motivo obrigatório para cancelar/no-show — validado no service e de novo na RPC. */
export const reservationStatusActionSchema = z.object({
  bookingId: z.string().uuid('Reserva inválida.'),
  status: z.enum(ownerAllowedStatuses),
  reason: z.string().trim().max(500).optional(),
})
export type ReservationStatusActionInput = z.infer<typeof reservationStatusActionSchema>

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

export const pousadaSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(120, 'Nome muito longo.'),
  legalName: z.string().trim().max(160, 'Razão social muito longa.'),
  taxId: z.string().trim().max(30, 'Documento fiscal muito longo.'),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80, 'Cidade muito longa.'),
  state: ufSchema.transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2, 'Informe o país.').max(60, 'País muito longo.'),
  address: z.string().trim().max(200, 'Endereço muito longo.'),
  cep: cepSchema.or(z.literal('')),
  image: z.string().trim().url('Informe uma URL de imagem válida.').or(z.literal('')),
  description: z.string().trim().min(20, 'Descreva melhor a pousada.').max(1500),
  tags: z.string().trim().max(160, 'Use no máximo 160 caracteres.'),
  timezone: z.string().trim().min(2, 'Informe o fuso horário.').max(60),
  currency: z.string().trim().length(3, 'Use o código de 3 letras (ex.: BRL).').transform((v) => v.toUpperCase()),
  language: z.string().trim().min(2, 'Informe o idioma.').max(10),
  checkinTime: z.string().regex(timeRegex, 'Horário inválido.'),
  checkoutTime: z.string().regex(timeRegex, 'Horário inválido.'),
  contactPhone: phoneSchema.or(z.literal('')),
  whatsapp: phoneSchema.or(z.literal('')),
  notificationEmail: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .or(z.literal('')),
  houseRules: z.string().trim().max(1500, 'Regras muito longas.'),
  cancellationPolicy: z.string().trim().max(1500, 'Política muito longa.'),
})
export type PousadaSettingsInput = z.infer<typeof pousadaSettingsSchema>
