import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { requireCapability } from '@/features/acomodacoes/services/access'
import { getBookableRoomBySlug } from '@/repositories/rooms.repository'
import {
  createBookingRpc,
  getBookingByGuest,
  listBookingsByGuest,
  setBookingStatusRpc,
} from '@/repositories/bookings.repository'
import { upsertGuestRpc } from '@/repositories/guests.repository'
import { calculateBookingPrice } from '@/features/reservas/pricing'
import type { CreateBookingInput, CreateBookingAdminInput } from '@/features/reservas/schemas'
import type { Booking } from '@/features/reservas/types'

function generateBookingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `RP-${suffix}`
}

const PAYMENT_DEADLINE_HOURS = 24

function paymentDueAt(): string {
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + PAYMENT_DEADLINE_HOURS)
  return dueAt.toISOString()
}

/**
 * Cria uma reserva PÚBLICA. Concentra as regras de negócio: exige
 * autenticação, valida capacidade e período, congela o preço no ato, resolve
 * (ou cria) o cadastro de hóspede desta pousada para o viajante autenticado,
 * e cria a reserva como `pending` — a RPC `create_booking` (0034) revalida
 * TUDO de novo no banco (disponibilidade real, capacidade, conflito),
 * nunca confia apenas neste cálculo do servidor de aplicação.
 */
export async function createBooking(input: CreateBookingInput): Promise<{ code: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para concluir a reserva.')

  const bookable = await getBookableRoomBySlug(input.pousadaSlug)
  if (!bookable) throw new Error('Esta pousada não está disponível para reserva.')

  if (input.guests > bookable.capacity) {
    throw new Error(`Capacidade máxima de ${bookable.capacity} hóspedes para esta acomodação.`)
  }

  const price = calculateBookingPrice(bookable.nightly, input.checkin, input.checkout)
  if (price.nights < 1) throw new Error('Selecione um período válido (mínimo de 1 noite).')

  const { id: guestId } = await upsertGuestRpc({
    pousadaId: bookable.pousadaId,
    userId: user.id,
    fullName: user.name,
    email: user.email,
    source: 'public_booking',
  })

  const { code } = await createBookingRpc({
    pousadaId: bookable.pousadaId,
    roomId: bookable.roomId,
    responsibleGuestId: guestId,
    code: generateBookingCode(),
    checkin: input.checkin,
    checkout: input.checkout,
    adults: input.guests,
    children: 0,
    infants: 0,
    pets: false,
    subtotal: price.subtotal,
    fee: price.fee,
    discount: 0,
    surcharge: 0,
    servicesAmount: 0,
    total: price.total,
    status: 'pending',
    origin: 'rota_das_pousadas',
    travelerUserId: user.id,
    paymentDueAt: paymentDueAt(),
  })

  return { code }
}

/**
 * Criação ADMINISTRATIVA (recepção/proprietário/admin) — `booking:manage`.
 * O hóspede responsável é resolvido via `upsert_guest` a partir dos campos
 * do formulário (reaproveita cadastro existente pelo mesmo critério da RPC:
 * e-mail/telefone/documento normalizados, dentro da mesma pousada).
 */
export async function createAdminBooking(input: CreateBookingAdminInput): Promise<{ id: string; code: string }> {
  const { pousadaId } = await requireCapability('booking:manage')

  const price = calculateBookingPrice(input.nightlyRate, input.checkin, input.checkout, {
    discount: input.discount,
    surcharge: input.surcharge,
    servicesAmount: input.servicesAmount,
  })

  const { id: guestId } = await upsertGuestRpc({
    pousadaId,
    guestId: input.guestId,
    fullName: input.guestFullName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
    source: 'front_desk',
  })

  return createBookingRpc({
    pousadaId,
    roomId: input.roomId,
    responsibleGuestId: guestId,
    code: generateBookingCode(),
    checkin: input.checkin,
    checkout: input.checkout,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    pets: input.pets,
    subtotal: price.subtotal,
    fee: price.fee,
    discount: price.discount,
    surcharge: price.surcharge,
    servicesAmount: price.servicesAmount,
    total: price.total,
    status: input.initialStatus,
    origin: input.origin,
    externalChannelName: input.externalChannelName || null,
    externalCode: input.externalCode || null,
    expectedArrivalTime: input.expectedArrivalTime || null,
    specialRequests: input.specialRequests || '',
    internalNotes: input.internalNotes || '',
    paymentDueAt: input.initialStatus === 'pending' ? paymentDueAt() : null,
  })
}

/** Reservas do usuário autenticado (vazio se anônimo). */
export async function listMyBookings(): Promise<Booking[]> {
  const user = await getCurrentUser()
  if (!user) return []
  return listBookingsByGuest(user.id)
}

/** Cancela uma reserva do hóspede enquanto ela ainda não foi confirmada (RPC valida de novo). */
export async function cancelMyBooking(bookingId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para cancelar a reserva.')

  const booking = await getBookingByGuest(bookingId, user.id)
  if (!booking) throw new Error('Reserva não encontrada.')

  await setBookingStatusRpc(bookingId, 'cancelled', 'Cancelado pelo hóspede')
}

/** Dados da acomodação reservável de uma pousada (nome, diária, capacidade) para exibição pública. */
export async function getBookableRoom(
  slug: string,
): Promise<{ name: string; description: string; nightly: number; capacity: number } | null> {
  const bookable = await getBookableRoomBySlug(slug)
  if (!bookable) return null
  return {
    name: bookable.name,
    description: bookable.description,
    nightly: bookable.nightly,
    capacity: bookable.capacity,
  }
}
