import 'server-only'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { can } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import {
  getManagedPousada,
  getPousadaSettings,
  listReservationsByPousada,
  listBookingRanges,
  listBlockedDates,
  blockDate,
  unblockDate,
  updatePousadaSettings,
  updateReservationStatusByPousada,
} from '@/repositories/management.repository'
import { expirePendingBookingRpc } from '@/repositories/bookings.repository'
import {
  listReviewsByPousada,
  updateReviewResponseByPousada,
} from '@/repositories/reviews.repository'
import type {
  ManagedPousada,
  OwnerPousadaSettings,
  OwnerReservation,
  OwnerReview,
} from '@/features/gestao/types'
import type { PousadaSettingsInput } from '@/features/gestao/schemas'
import type { BookingStatus } from '@/features/reservas/types'

/**
 * Resolve a pousada gerida a partir do CONTEXTO ATIVO (lib/auth/tenant-context.ts),
 * nunca do primeiro membership encontrado — um usuário pode ter vínculos com
 * várias pousadas, e apenas a que ele selecionou (ou a única ativa) conta.
 */
async function resolveOwnerPousada(): Promise<ManagedPousada | null> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) return null
  return getManagedPousada(pousadaId)
}

export async function getOwnerPousada(): Promise<ManagedPousada | null> {
  return resolveOwnerPousada()
}

export async function getOwnerSettings(): Promise<OwnerPousadaSettings | null> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) return null
  return getPousadaSettings(pousada.id)
}

export async function updateOwnerSettings(input: PousadaSettingsInput): Promise<void> {
  const [pousada, role, user] = await Promise.all([
    resolveOwnerPousada(),
    getActiveTenantRole(),
    getCurrentUser(),
  ])
  if (!pousada || !user) throw new Error('Nenhuma pousada sob sua gestão.')
  if (!role || !can(role, 'pousada:edit')) {
    throw new Error('Você não tem permissão para editar as configurações da pousada.')
  }

  await updatePousadaSettings(pousada.id, {
    name: input.name,
    legalName: input.legalName,
    taxId: input.taxId,
    city: input.city,
    state: input.state,
    country: input.country,
    address: input.address,
    image: input.image,
    description: input.description,
    tags: input.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8),
    timezone: input.timezone,
    currency: input.currency,
    language: input.language,
    checkinTime: input.checkinTime,
    checkoutTime: input.checkoutTime,
    contactPhone: input.contactPhone,
    whatsapp: input.whatsapp,
    notificationEmail: input.notificationEmail,
    houseRules: input.houseRules,
    cancellationPolicy: input.cancellationPolicy,
  })

  await logAudit({
    actorId: user.id,
    action: 'pousada.settings_updated',
    targetTable: 'pousadas',
    targetId: pousada.id,
  })
}

export async function listOwnerReservations(filters: Parameters<typeof listReservationsByPousada>[1] = {}): Promise<OwnerReservation[]> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) return []
  return listReservationsByPousada(pousada.id, filters)
}

export async function getOwnerCalendar(): Promise<{
  occupied: { checkin: string; checkout: string }[]
  blocked: string[]
}> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) return { occupied: [], blocked: [] }
  const [occupied, blocked] = await Promise.all([
    listBookingRanges(pousada.id),
    pousada.roomId ? listBlockedDates(pousada.roomId) : Promise.resolve<string[]>([]),
  ])
  return { occupied, blocked }
}

export async function blockOwnerDate(date: string): Promise<void> {
  const pousada = await resolveOwnerPousada()
  if (!pousada?.roomId) throw new Error('Nenhuma pousada sob sua gestão.')
  await blockDate(pousada.id, pousada.roomId, date)
}

export async function unblockOwnerDate(date: string): Promise<void> {
  const pousada = await resolveOwnerPousada()
  if (!pousada?.roomId) throw new Error('Nenhuma pousada sob sua gestão.')
  await unblockDate(pousada.id, pousada.roomId, date)
}

/**
 * [Ciclo 4] Checagem de RBAC explícita — antes, esta função chamava
 * `.update()` direto sem checar `can()` nenhuma (achado da auditoria do
 * Ciclo 4). A RPC `set_booking_status` (0034) já reimplementa a MESMA regra
 * no banco (segunda barreira) — esta checagem aqui é só a primeira, para
 * feedback rápido de UI.
 */
export async function updateOwnerReservationStatus(
  bookingId: string,
  status: BookingStatus,
  reason?: string,
): Promise<void> {
  const role = await getActiveTenantRole()
  const action = status === 'cancelled' ? 'booking:cancel' : status === 'no_show' ? 'booking:no_show' : 'booking:manage'
  if (!role || !can(role, action)) throw new Error('Você não tem permissão para esta ação.')
  const pousada = await resolveOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await updateReservationStatusByPousada(pousada.id, bookingId, status, reason)
}

export async function expireOwnerPendingBooking(bookingId: string): Promise<void> {
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'booking:manage')) throw new Error('Você não tem permissão para esta ação.')
  const pousada = await resolveOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await expirePendingBookingRpc(bookingId)
}

export async function listOwnerReviews(): Promise<OwnerReview[]> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) return []
  return listReviewsByPousada(pousada.id)
}

export async function respondOwnerReview(reviewId: string, response: string): Promise<void> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await updateReviewResponseByPousada(pousada.id, reviewId, response)
}
