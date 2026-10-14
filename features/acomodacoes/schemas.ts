import { z } from 'zod'

const BED_TYPES = [
  'casal',
  'queen',
  'king',
  'solteiro',
  'beliche',
  'sofa_cama',
  'berco',
  'outro',
] as const
export const bedConfigItemSchema = z.object({
  type: z.enum(BED_TYPES),
  quantity: z.coerce.number().int().min(1).max(20),
})
export const bedConfigSchema = z.array(bedConfigItemSchema).max(10)

export const categorySchema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome.').max(80),
    code: z.string().trim().max(20).optional().or(z.literal('')),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    defaultCapacity: z.coerce.number().int().min(1).max(50),
    maxCapacity: z.coerce.number().int().min(1).max(50).optional(),
    defaultBedCount: z.coerce.number().int().min(1).max(20),
    basePriceSuggestion: z.coerce.number().int().min(0).max(1000000).optional(),
    displayOrder: z.coerce.number().int().min(0).max(999),
  })
  .refine((v) => v.maxCapacity === undefined || v.maxCapacity >= v.defaultCapacity, {
    message: 'A capacidade máxima não pode ser menor que a padrão.',
    path: ['maxCapacity'],
  })
export type CategoryInput = z.infer<typeof categorySchema>

export const categoryIdSchema = z.object({ id: z.string().uuid('Identificador inválido.') })
export type CategoryIdInput = z.infer<typeof categoryIdSchema>

export const roomSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome da acomodação.').max(80),
    code: z.string().trim().max(30).optional().or(z.literal('')),
    categoryId: z.string().uuid().optional().or(z.literal('')),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    operationalDescription: z.string().trim().max(1000).optional().or(z.literal('')),
    location: z.string().trim().max(80).optional().or(z.literal('')),
    capacity: z.coerce.number().int().min(1, 'Mínimo de 1 hóspede.').max(50),
    capacityMax: z.coerce.number().int().min(1).max(50).optional(),
    adultsMax: z.coerce.number().int().min(1).max(50).optional(),
    childrenMax: z.coerce.number().int().min(0).max(20),
    infantsAllowed: z.coerce.boolean(),
    petsAllowed: z.coerce.boolean(),
    bedConfig: bedConfigSchema,
    accessible: z.coerce.boolean(),
    basePrice: z.coerce.number().int().min(0, 'A diária não pode ser negativa.').max(1000000),
    publicVisible: z.coerce.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(999),
    internalNotes: z.string().trim().max(1000).optional().or(z.literal('')),
    amenityIds: z.array(z.string().uuid()),
  })
  .refine((v) => v.capacityMax === undefined || v.capacityMax >= v.capacity, {
    message: 'A capacidade máxima não pode ser menor que a padrão.',
    path: ['capacityMax'],
  })
export type RoomInput = z.infer<typeof roomSchema>

export const roomIdSchema = z.object({ id: z.string().uuid('Identificador inválido.') })
export type RoomIdInput = z.infer<typeof roomIdSchema>

export const roomStatusSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
  status: z.enum(['active', 'inactive']),
})
export type RoomStatusInput = z.infer<typeof roomStatusSchema>

export const roomOperationalStatusSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
  status: z.enum([
    'available',
    'occupied',
    'awaiting_cleaning',
    'cleaning',
    'inspection_pending',
    'maintenance',
    'blocked',
  ]),
})
export type RoomOperationalStatusInput = z.infer<typeof roomOperationalStatusSchema>

const BLOCK_TYPES = [
  'maintenance',
  'internal_use',
  'owner_reservation',
  'interdiction',
  'renovation',
  'operational_unavailability',
  'other',
] as const

/** Valor de `<input type="datetime-local">`: data e hora, sem fuso (ver `civilDateTimeToISO`). */
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

export const createBlockSchema = z
  .object({
    roomId: z.string().uuid('Selecione a acomodação.'),
    blockType: z.enum(BLOCK_TYPES),
    startsAt: z.string().regex(LOCAL_DATE_TIME, 'Informe a data/hora inicial.'),
    endsAt: z.string().regex(LOCAL_DATE_TIME, 'Informe a data/hora final.'),
    reason: z.string().trim().min(3, 'Informe o motivo do bloqueio.').max(300),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(), {
    message: 'A data final deve ser posterior à inicial.',
    path: ['endsAt'],
  })
export type CreateBlockInput = z.infer<typeof createBlockSchema>

export const cancelBlockSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
  cancellationReason: z.string().trim().min(3, 'Informe o motivo do cancelamento.').max(300),
})
export type CancelBlockInput = z.infer<typeof cancelBlockSchema>

export const availabilityQuerySchema = z
  .object({
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
    adults: z.coerce.number().int().min(1).max(50),
    children: z.coerce.number().int().min(0).max(50),
    pets: z.coerce.boolean(),
    categoryId: z.string().uuid().optional().or(z.literal('')),
  })
  .refine((d) => d.checkout > d.checkin, {
    message: 'A saída deve ser posterior à entrada.',
    path: ['checkout'],
  })
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>
