export type BedType =
  'casal' | 'queen' | 'king' | 'solteiro' | 'beliche' | 'sofa_cama' | 'berco' | 'outro'
export type BedConfigItem = { type: BedType; quantity: number }

export type AccommodationStatus = 'active' | 'inactive'
export type RoomOperationalStatus =
  | 'available'
  | 'occupied'
  | 'awaiting_cleaning'
  | 'cleaning'
  | 'inspection_pending'
  | 'maintenance'
  | 'blocked'

export type AccommodationCategory = {
  id: string
  name: string
  code: string | null
  description: string
  defaultCapacity: number
  maxCapacity: number | null
  defaultBedCount: number
  basePriceSuggestion: number | null
  displayOrder: number
  status: AccommodationStatus
  roomCount: number
}

/**
 * Acomodação (quarto) na visão de gestão. `basePrice` fica `undefined`
 * (nunca 0/null forjado) quando o chamador é Governança — ver
 * services/rooms.service.ts (projeção no servidor, mesma decisão do
 * "Conflito B" do Ciclo 1).
 */
export type ManagedRoom = {
  id: string
  name: string
  code: string | null
  categoryId: string | null
  categoryName: string | null
  description: string
  operationalDescription: string
  location: string
  capacity: number
  capacityMax: number | null
  adultsMax: number | null
  childrenMax: number
  infantsAllowed: boolean
  petsAllowed: boolean
  bedConfig: BedConfigItem[]
  accessible: boolean
  basePrice?: number
  status: AccommodationStatus
  operationalStatus: RoomOperationalStatus
  publicVisible: boolean
  displayOrder: number
  internalNotes: string
  /** Fotos da acomodação (0087), a principal primeiro. */
  gallery: string[]
  amenityIds: string[]
  createdAt: string
  updatedAt: string
}

/**
 * [Ciclo 3B] Projeção operacional mínima de `rooms` para Governança —
 * NUNCA inclui base_price, categoria, visibilidade pública ou notas
 * comerciais. Vem exclusivamente da RPC `list_rooms_for_housekeeping`
 * (rooms_read na RLS nem concede a Governança leitura direta da tabela).
 */
export type HousekeepingRoom = {
  id: string
  name: string
  code: string | null
  location: string
  operationalStatus: RoomOperationalStatus
  capacity: number
  nextBlockStartsAt: string | null
  operationalNote: string
}

export type RoomBlockType =
  | 'maintenance'
  | 'internal_use'
  | 'owner_reservation'
  | 'interdiction'
  | 'renovation'
  | 'operational_unavailability'
  | 'other'
export type RoomBlockStatus = 'active' | 'cancelled' | 'expired'

export type RoomBlock = {
  id: string
  roomId: string
  roomName: string
  blockType: RoomBlockType
  startsAt: string
  endsAt: string
  reason: string
  notes: string
  status: RoomBlockStatus
  createdBy: string | null
  cancelledBy: string | null
  createdAt: string
  cancelledAt: string | null
  cancellationReason: string | null
}

export type AvailabilityReason =
  | 'inactive_room'
  | 'inactive_category'
  | 'insufficient_capacity'
  | 'pets_not_allowed'
  | 'operational_status_blocking'
  | 'blocked_period'
  | 'booking_conflict'
  | 'channel_conflict'
  | 'invalid_dates'

export type AvailabilityResult = {
  roomId: string
  roomName: string
  categoryName: string | null
  capacity: number
  available: boolean
  reasons: AvailabilityReason[]
}

/** Regra de tarifa por período (0087). Datas por NOITE, as duas pontas inclusivas. */
export type RateRule = {
  id: string
  name: string
  /** `null` = vale para todas as acomodações. */
  roomId: string | null
  roomName: string | null
  firstNight: string
  lastNight: string
  /** Dias da semana da noite (0 = domingo … 6 = sábado); `null` = todos. */
  weekdays: number[] | null
  kind: 'fixed' | 'percent'
  value: number
  minNights: number | null
  active: boolean
}
