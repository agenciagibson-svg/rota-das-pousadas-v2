import 'server-only'
import { listBookingIdsWithOpenProof } from '@/repositories/pix.repository'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { can, type Action } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import {
  getManagedPousada,
  getPousadaSettings,
  listReservationsByPousada,
  listBookingRanges,
  listActiveRoomsByPousada,
  listBlockedDaysByPousada,
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
    cep: input.cep ?? '',
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

export async function listOwnerReservations(
  filters: Parameters<typeof listReservationsByPousada>[1] = {},
): Promise<OwnerReservation[]> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) return []
  const [reservations, withProof] = await Promise.all([
    listReservationsByPousada(pousada.id, filters),
    listBookingIdsWithOpenProof(pousada.id),
  ])
  return reservations.map((r) => (withProof.has(r.id) ? { ...r, proofPending: true } : r))
}

export type OwnerCalendar = {
  rooms: { id: string; name: string }[]
  bookings: { roomId: string; checkin: string; checkout: string }[]
  blocks: { roomId: string; date: string }[]
  /** Pode bloquear/liberar dias (`room:block:manage`). */
  canBlock: boolean
}

/** Calendário por quarto: reservas e bloqueios de cada quarto ativo da pousada. */
export async function getOwnerCalendar(): Promise<OwnerCalendar> {
  const [pousada, role] = await Promise.all([resolveOwnerPousada(), getActiveTenantRole()])
  if (!pousada) return { rooms: [], bookings: [], blocks: [], canBlock: false }
  const [rooms, bookings, blocks] = await Promise.all([
    listActiveRoomsByPousada(pousada.id),
    listBookingRanges(pousada.id),
    listBlockedDaysByPousada(pousada.id),
  ])
  return { rooms, bookings, blocks, canBlock: Boolean(role && can(role, 'room:block:manage')) }
}

/** Bloqueio de dia pelo calendário: exige `room:block:manage` (a RLS/RPC é a 2ª barreira). */
async function requireCalendarPousada(): Promise<ManagedPousada> {
  const [pousada, role] = await Promise.all([resolveOwnerPousada(), getActiveTenantRole()])
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  if (!role || !can(role, 'room:block:manage')) {
    throw new Error('Você não tem permissão para bloquear datas.')
  }
  return pousada
}

function nightsOf(checkin: string, checkout: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${checkin}T00:00:00Z`)
  const end = new Date(`${checkout}T00:00:00Z`)
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/** Quartos alvo: um quarto específico (validado) ou todos os ativos. */
async function targetRooms(
  pousadaId: string,
  roomId?: string,
): Promise<{ id: string; name: string }[]> {
  const rooms = await listActiveRoomsByPousada(pousadaId)
  if (!roomId) return rooms
  const room = rooms.find((r) => r.id === roomId)
  if (!room) throw new Error('Quarto não encontrado nesta pousada.')
  return [room]
}

/**
 * Bloqueia o dia num quarto ou, sem `roomId`, em todos os quartos que estão
 * livres naquele dia (quarto reservado ou já bloqueado fica como está).
 */
export async function blockOwnerDate(date: string, roomId?: string): Promise<{ affected: number }> {
  const pousada = await requireCalendarPousada()
  const [rooms, bookings, blocks] = await Promise.all([
    targetRooms(pousada.id, roomId),
    listBookingRanges(pousada.id),
    listBlockedDaysByPousada(pousada.id),
  ])
  const busy = new Set<string>()
  for (const b of bookings) {
    if (nightsOf(b.checkin, b.checkout).includes(date)) busy.add(b.roomId)
  }
  for (const b of blocks) if (b.date === date) busy.add(b.roomId)

  const free = rooms.filter((r) => !busy.has(r.id))
  if (free.length === 0) {
    throw new Error(
      roomId
        ? 'Este quarto não está livre neste dia.'
        : 'Nenhum quarto livre para bloquear neste dia.',
    )
  }
  for (const r of free) await blockDate(pousada.id, r.id, date)
  return { affected: free.length }
}

/**
 * Libera o dia num quarto ou, sem `roomId`, em todos os quartos bloqueados
 * naquele dia. Bloqueio de vários dias (tela de Bloqueios) não é desfeito por
 * aqui — avisa em vez de cancelar um bloqueio maior por engano.
 */
export async function unblockOwnerDate(
  date: string,
  roomId?: string,
): Promise<{ affected: number }> {
  const pousada = await requireCalendarPousada()
  const [rooms, blocks] = await Promise.all([
    targetRooms(pousada.id, roomId),
    listBlockedDaysByPousada(pousada.id),
  ])
  const blockedRooms = rooms.filter((r) => blocks.some((b) => b.roomId === r.id && b.date === date))
  if (blockedRooms.length === 0) throw new Error('Não há bloqueio neste dia.')

  let affected = 0
  const skipped: string[] = []
  for (const r of blockedRooms) {
    try {
      await unblockDate(pousada.id, r.id, date)
      affected++
    } catch {
      skipped.push(r.name)
    }
  }
  if (skipped.length > 0) {
    throw new Error(
      `${affected > 0 ? `Liberado em ${affected} quarto(s). ` : ''}${skipped.join(', ')}: bloqueio de vários dias — cancele em Acomodações › Bloqueios.`,
    )
  }
  return { affected }
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
  const action: Action =
    status === 'cancelled'
      ? 'booking:cancel'
      : status === 'no_show'
        ? 'booking:no_show'
        : status === 'checked_in'
          ? 'checkin:perform'
          : status === 'checked_out'
            ? 'checkout:perform'
            : 'booking:manage'
  if (!role || !can(role, action)) throw new Error('Você não tem permissão para esta ação.')
  const pousada = await resolveOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await updateReservationStatusByPousada(pousada.id, bookingId, status, reason)
}

export async function expireOwnerPendingBooking(bookingId: string): Promise<void> {
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'booking:manage'))
    throw new Error('Você não tem permissão para esta ação.')
  const pousada = await resolveOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await expirePendingBookingRpc(bookingId)
}

export async function listOwnerReviews(): Promise<OwnerReview[]> {
  const pousada = await resolveOwnerPousada()
  if (!pousada) return []
  return listReviewsByPousada(pousada.id)
}

/**
 * Checagem de RBAC explícita (achado da auditoria de 16/09/2026: faltava, ao
 * contrário das funções irmãs desta file). A RLS de `reviews` continua sendo
 * a segunda barreira — sem ela, papéis sem `review:respond` (recepção,
 * financeiro, governança) só viam um erro cru do Postgres em vez de mensagem
 * amigável, mas a escrita já era recusada de qualquer forma.
 */
export async function respondOwnerReview(reviewId: string, response: string): Promise<void> {
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'review:respond'))
    throw new Error('Você não tem permissão para responder avaliações.')
  const pousada = await resolveOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  await updateReviewResponseByPousada(pousada.id, reviewId, response)
}
