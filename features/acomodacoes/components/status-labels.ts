import type { RoomOperationalStatus, RoomBlockType, AvailabilityReason } from '../types'

type BadgeVariant = 'primarySoft' | 'goldSoft' | 'destructiveSoft' | 'secondary' | 'accentSoft'

export const OPERATIONAL_STATUS_LABEL: Record<
  RoomOperationalStatus,
  { label: string; variant: BadgeVariant }
> = {
  available: { label: 'Disponível', variant: 'primarySoft' },
  occupied: { label: 'Ocupada', variant: 'accentSoft' },
  awaiting_cleaning: { label: 'Aguardando limpeza', variant: 'goldSoft' },
  cleaning: { label: 'Em limpeza', variant: 'goldSoft' },
  inspection_pending: { label: 'Inspeção pendente', variant: 'goldSoft' },
  maintenance: { label: 'Manutenção', variant: 'destructiveSoft' },
  blocked: { label: 'Bloqueada', variant: 'destructiveSoft' },
}

export const BLOCK_TYPE_LABEL: Record<RoomBlockType, string> = {
  maintenance: 'Manutenção',
  internal_use: 'Uso interno',
  owner_reservation: 'Reserva do proprietário',
  interdiction: 'Interdição',
  renovation: 'Reforma',
  operational_unavailability: 'Indisponibilidade operacional',
  other: 'Outro',
}

export const AVAILABILITY_REASON_LABEL: Record<AvailabilityReason, string> = {
  inactive_room: 'Acomodação inativa',
  inactive_category: 'Categoria inativa',
  insufficient_capacity: 'Capacidade insuficiente',
  pets_not_allowed: 'Não aceita pets',
  operational_status_blocking: 'Em manutenção/bloqueada',
  blocked_period: 'Bloqueio no período',
  booking_conflict: 'Reserva conflitante',
  channel_conflict: 'Ocupada no Airbnb/Booking',
  invalid_dates: 'Datas inválidas',
}
