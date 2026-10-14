import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getMyProfile } from '@/features/auth/services/profile.service'
import { requireCapability } from '@/features/acomodacoes/services/access'
import { getBookableRoomBySlug } from '@/repositories/rooms.repository'
import {
  createBookingRpc,
  getBookingByGuest,
  getBookingNotificationContextRpc,
  getBookingPousadaId,
  hasUnreadableCompanionDocuments,
  listBookingsByGuest,
  setBookingCompanionsRpc,
  setBookingStatusRpc,
  updateBookingRpc,
} from '@/repositories/bookings.repository'
import { ensureTravelerGuestRpc, upsertGuestRpc } from '@/repositories/guests.repository'
import { calculateBookingPrice } from '@/features/reservas/pricing'
import { sendEmail } from '@/lib/email/mailer'
import { bookingRequestReceivedEmail } from '@/lib/email/templates'
import type {
  CreateBookingInput,
  CreateBookingAdminInput,
  SetBookingCompanionsInput,
  UpdateBookingInput,
} from '@/features/reservas/schemas'
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
export async function createBooking(
  input: CreateBookingInput,
): Promise<{ id: string; code: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para concluir a reserva.')

  const bookable = await getBookableRoomBySlug(
    input.pousadaSlug,
    input.checkin,
    input.checkout,
    input.guests,
  )
  if (!bookable) throw new Error('Esta pousada não está disponível para reserva.')
  if (input.expectedNightly !== undefined && input.expectedNightly !== bookable.nightly) {
    throw new Error(
      'A diária disponível mudou. Volte à busca com estas datas e hóspedes para revisar o valor antes de reservar.',
    )
  }

  if (input.guests > bookable.capacity) {
    throw new Error(`Capacidade máxima de ${bookable.capacity} hóspedes para esta acomodação.`)
  }

  const price = calculateBookingPrice(bookable.nightly, input.checkin, input.checkout)
  if (price.nights < 1) throw new Error('Selecione um período válido (mínimo de 1 noite).')

  // Porta pública, não a do balcão: `upsert_guest` exige acesso de staff e
  // recusava a sessão do viajante — era o que travava a reserva pública.
  // O nome vem do cadastro; sem ele a pousada recebe uma reserva anônima.
  if (user.name.trim().length < 2) {
    throw new Error('Complete seu nome no cadastro antes de reservar.')
  }
  // A pousada recebe o cadastro para a ficha de hospedagem (0073). A página de
  // reservar já bloqueia antes; aqui é a trava de verdade, no servidor.
  const me = await getMyProfile()
  if (!me || me.missing.length > 0) {
    throw new Error(
      `Complete seu cadastro em Meu perfil antes de reservar (falta: ${me?.missing.join(', ') ?? 'cadastro'}).`,
    )
  }
  const { id: guestId } = await ensureTravelerGuestRpc({
    pousadaId: bookable.pousadaId,
    fullName: user.name,
    email: user.email,
  })

  const { id, code } = await createBookingRpc({
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
    origin: input.origin ?? 'rota_das_pousadas',
    travelerUserId: user.id,
    paymentDueAt: paymentDueAt(),
  })

  // Notificação por e-mail (0060) — nunca bloqueia a reserva se falhar.
  await notifyBookingRequestReceived(id)

  return { id, code }
}

/**
 * Envia o e-mail de "pedido recebido" (0060). Fail-soft: qualquer falha aqui
 * (RPC, SMTP) é logada e engolida — a reserva já foi criada com sucesso e
 * nunca deve ser desfeita por causa de uma notificação.
 */
async function notifyBookingRequestReceived(bookingId: string): Promise<void> {
  try {
    const ctx = await getBookingNotificationContextRpc(bookingId)
    if (!ctx || !ctx.guestEmail) return
    const { subject, html, text } = bookingRequestReceivedEmail(ctx)
    await sendEmail({ to: ctx.guestEmail, subject, html, text })
  } catch (error) {
    console.error(`[email] Falha ao notificar pedido recebido da reserva ${bookingId}:`, error)
  }
}

/**
 * Criação ADMINISTRATIVA (recepção/proprietário/admin) — `booking:manage`.
 * O hóspede responsável é resolvido via `upsert_guest` a partir dos campos
 * do formulário (reaproveita cadastro existente pelo mesmo critério da RPC:
 * e-mail/telefone/documento normalizados, dentro da mesma pousada).
 */
export async function createAdminBooking(
  input: CreateBookingAdminInput,
): Promise<{ id: string; code: string }> {
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

/**
 * O papel é conferido na pousada ATIVA (cookie); a reserva vem do formulário.
 * Sem esta checagem, quem tem `booking:manage` na pousada A e acesso mais
 * fraco na B conseguia mandar o id de uma reserva da B. A RPC repete a
 * conferência no banco — as duas barreiras precisam concordar.
 */
async function requireBookingInActivePousada(bookingId: string, pousadaId: string): Promise<void> {
  if ((await getBookingPousadaId(bookingId)) !== pousadaId) {
    throw new Error('Reserva não encontrada nesta pousada.')
  }
}

/** Edição administrativa — sempre com `version` (concorrência otimista, ver 0034). */
export async function updateAdminBooking(input: UpdateBookingInput): Promise<{ version: number }> {
  const { pousadaId } = await requireCapability('booking:manage')
  await requireBookingInActivePousada(input.bookingId, pousadaId)

  // Preço sempre recalculado no servidor a partir da diária informada.
  const price = calculateBookingPrice(input.nightlyRate, input.checkin, input.checkout, {
    discount: input.discount,
    surcharge: input.surcharge,
    servicesAmount: input.servicesAmount,
  })
  return updateBookingRpc({
    bookingId: input.bookingId,
    version: input.version,
    roomId: input.roomId,
    responsibleGuestId: input.guestId,
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
    origin: input.origin,
    expectedArrivalTime: input.expectedArrivalTime || null,
    specialRequests: input.specialRequests || '',
    internalNotes: input.internalNotes || '',
  })
}

/** Acompanhantes da reserva (ficha de hóspedes). O documento vai cifrado (0083). */
export async function setAdminBookingCompanions(
  input: SetBookingCompanionsInput,
): Promise<{ version: number }> {
  const { pousadaId } = await requireCapability('booking:manage')
  await requireBookingInActivePousada(input.bookingId, pousadaId)
  // A RPC apaga e regrava todas as linhas. Se algum documento já salvo não
  // decifra neste ambiente, o formulário abriu com ele vazio — salvar agora
  // apagaria o original sem ninguém perceber.
  if (await hasUnreadableCompanionDocuments(input.bookingId)) {
    throw new Error(
      'Não foi possível ler os documentos já salvos desta reserva. Para não perder esses dados, a alteração foi bloqueada — fale com o suporte da Rota.',
    )
  }
  return setBookingCompanionsRpc(input.bookingId, input.version, input.companions)
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
  checkin?: string,
  checkout?: string,
  guests = 1,
): Promise<{ name: string; description: string; nightly: number; capacity: number } | null> {
  const bookable = await getBookableRoomBySlug(slug, checkin, checkout, guests)
  if (!bookable) return null
  return {
    name: bookable.name,
    description: bookable.description,
    nightly: bookable.nightly,
    capacity: bookable.capacity,
  }
}
