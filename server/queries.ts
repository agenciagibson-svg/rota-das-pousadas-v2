/**
 * Server-side data-access helpers.
 *
 * Thin wrappers around the service layer that add request-level memoization
 * (React `cache`) so the same data isn't fetched twice while rendering a single
 * request. This is the layer Server Components and `generateMetadata` call.
 *
 * When a real backend arrives, add `unstable_cache`/`revalidate` here to get
 * cross-request caching + ISR without touching components.
 */
import 'server-only'
import { cache } from 'react'
import * as pousadas from '@/services/pousadas.service'
import * as destinations from '@/services/destinations.service'
import { getCurrentUser as currentUser } from '@/features/auth/services/auth.service'
import { getMyProfile as myProfile } from '@/features/auth/services/profile.service'
import { reconcileBookingPayments } from '@/features/pagamentos/services/webhook.service'
import {
  listMyBookings,
  getBookableRoom as bookableRoom,
  listPublicRooms as publicRooms,
} from '@/features/reservas/services/bookings.service'
import {
  getOwnerPousada as ownerPousada,
  getOwnerSettings as ownerSettings,
  listOwnerReservations,
  getOwnerCalendar as ownerCalendar,
  listOwnerReviews,
} from '@/features/gestao/services/pms.service'
import {
  listPending,
  isPlatformAdmin as platformAdmin,
} from '@/features/admin/services/admin.service'
import {
  getFinance as ownerFinance,
  canViewFinance as viewFinance,
  canManageExpenses as manageExpenses,
} from '@/features/financeiro/services/finance.service'
import {
  getOwnerRooms as ownerRooms,
  getHousekeepingRooms as housekeepingRooms,
} from '@/features/acomodacoes/services/rooms.service'
import { listCategories } from '@/features/acomodacoes/services/categories.service'
import { listRateRules } from '@/features/acomodacoes/services/rates.service'
import { listBlocks } from '@/features/acomodacoes/services/blocks.service'
import { listAmenitiesCatalog } from '@/repositories/rooms.repository'
import { getFavoriteState, listMyFavorites } from '@/features/favoritos/services/favorites.service'
import { listMyFavoriteAlertStates } from '@/features/alertas/services/favorite-alerts.service'
import { listTeam, listMyPendingInvites } from '@/features/membros/services/team.service'
import {
  listGuests,
  getGuestProfile as guestProfile,
} from '@/features/hospedes/services/guests.service'
import { listChannels as ownerChannels } from '@/features/canais/services/channels.service'
import {
  getLinkReport as linkReport,
  listQuoteRequests as quoteRequests,
} from '@/features/bio/services/bio.service'
import {
  bookingCanPayOnlineRpc,
  getBookingDetailById,
  getBookingFnrhData,
} from '@/repositories/bookings.repository'
import { getPousadaSettings } from '@/repositories/management.repository'
import { getStayReviewContext } from '@/features/estadia/services/stay.service'
import { createCheckoutPreference } from '@/features/pagamentos/services/checkout.service'
import { requireCapability } from '@/features/acomodacoes/services/access'
import { resolveTenantAccess } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import type { ListQuery } from '@/types'
import type { GuestFilters } from '@/features/hospedes/schemas'
import type { GestaoReservationFilters } from '@/features/gestao/schemas'

export const getPousadas = cache((query: ListQuery = {}) => pousadas.listPousadas(query))
export const getPousada = cache((slug: string) => pousadas.getPousadaBySlug(slug))
export const getPousadaSlugs = cache(() => pousadas.listPousadaSlugs())
export const getNearbyPousadas = cache((slug: string, limit?: number) =>
  pousadas.listNearbyPousadas(slug, limit),
)
/** Avaliações públicas de uma pousada (vazio em modo demonstração ou sem id). */
export const getPublicReviews = cache((pousadaId?: string, limit?: number) =>
  pousadas.listPublicReviews(pousadaId, limit),
)

export const getDestinations = cache(() => destinations.listDestinations())
export const getDestination = cache((slug: string) => destinations.getDestinationBySlug(slug))
export const getExperiences = cache(() => destinations.listExperiences())

/** Usuário autenticado atual (sessão + profile + papéis), memoizado por request. */
export const getCurrentUser = cache(() => currentUser())

/** Cadastro do viajante (0073) + o que falta para reservar. `null` = sem login. */
export const getMyProfile = cache(() => myProfile())

/**
 * Página de avaliação (link do e-mail, 0089): pousada, datas e se o usuário
 * logado pode avaliar esta reserva. `null` = reserva inexistente ou de outra conta.
 */
export const getStayReview = cache((bookingId: string) => getStayReviewContext(bookingId))

/** Reservas do usuário autenticado, memoizadas por request. */
export const getMyBookings = cache(() => listMyBookings())

/**
 * Igual a `getMyBookings`, mas antes confere no Mercado Pago as reservas
 * pendentes (rede de segurança do webhook — ver `reconcileBookingPayments`).
 * Usar só em "Minhas reservas" e na página de pagamento: é para onde o
 * hóspede volta depois de pagar. Se algo foi confirmado, relê a lista.
 */
export const getMyBookingsReconciled = cache(async () => {
  const bookings = await listMyBookings()
  const pending = bookings.filter((b) => b.status === 'pending' && b.balanceDue > 0).slice(0, 5)
  if (pending.length === 0) return bookings
  const results = await Promise.all(pending.map((b) => reconcileBookingPayments(b.id)))
  return results.some(Boolean) ? listMyBookings() : bookings
})

/** Acomodações publicadas da pousada, com fotos (0087), para a página da pousada. */
export const getPublicRooms = cache(
  (slug: string, checkin?: string, checkout?: string, guests = 1) =>
    publicRooms(slug, checkin, checkout, guests),
)

/** Acomodação reservável (diária, capacidade, fotos e cotação das datas) para o fluxo de reserva. */
export const getBookableRoom = cache(
  (slug: string, checkin?: string, checkout?: string, guests = 1, roomId?: string) =>
    bookableRoom(slug, checkin, checkout, guests, roomId),
)

/**
 * Pagamento: cria a preferência de checkout (Mercado Pago) da reserva do
 * hóspede autenticado. Lança erro se a pousada ainda não conectou a conta —
 * a página de pagamento trata isso como "a combinar", não como falha fatal.
 */
export const getBookingCheckout = cache((bookingId: string) => createCheckoutPreference(bookingId))

/**
 * A pousada desta reserva recebe on-line (conta Mercado Pago conectada)?
 * Só decide qual botão mostrar — o link de pagamento em si é criado apenas
 * no clique, em `/pousada/[slug]/reservar/[id]/pagar`. A RPC
 * `booking_can_pay_online` (0083) só responde `true` para o dono da reserva,
 * com a sessão do próprio usuário — sem service_role no caminho de render.
 */
export const getCanPayOnline = cache((bookingId: string) => bookingCanPayOnlineRpc(bookingId))

/** Gestão (PMS): pousada gerida, reservas e calendário do proprietário. */
export const getOwnerPousada = cache(() => ownerPousada())
export const getOwnerSettings = cache(() => ownerSettings())
export const getOwnerReservations = cache((filters: GestaoReservationFilters = {}) =>
  listOwnerReservations(filters),
)
export const getOwnerCalendar = cache(() => ownerCalendar())
export const getOwnerReviews = cache(() => listOwnerReviews())
export const canRespondReviews = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'review:respond')
})

/** Admin: pousadas pendentes de aprovação + verificação de papel de plataforma. */
export const getPendingPousadas = cache(() => listPending())
export const isPlatformAdmin = cache(() => platformAdmin())

/** Financeiro: resumo + extrato da pousada ativa (vazio para quem não tem `finance:pousada:view`). */
export const getFinance = cache(() => ownerFinance())
export const canViewFinance = cache(() => viewFinance())
export const canManageExpenses = cache(() => manageExpenses())

/** Acomodações: quartos, categorias e bloqueios da pousada ativa. */
export const getOwnerRooms = cache(() => ownerRooms())
export const getHousekeepingRooms = cache(() => housekeepingRooms())
export const getActiveRole = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' ? state.membership.role : null
})
export const getOwnerCategories = cache(() => listCategories())
export const getRateRules = cache(() => listRateRules())
export const getOwnerBlocks = cache(() => listBlocks())
export const getAmenitiesCatalog = cache(() => listAmenitiesCatalog())
export const canManageAccommodations = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'room:manage')
})
export const canChangeOperationalStatus = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'room:status:manage')
})
export const canManageBlocks = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'room:block:manage')
})

/** Convites pendentes do usuário atual (qualquer pousada) — tela de entrada do painel. */
export const getMyPendingInvites = cache(() => listMyPendingInvites())

/** Equipe: membros da pousada ativa + se o usuário pode convidar. */
export const getTeamMembers = cache(() => listTeam())
export const getTenantAccess = cache(() => resolveTenantAccess())
export const canInviteMembers = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'member:invite')
})

/** Hóspedes da pousada ativa. */
export const getOwnerGuests = cache((filters: GuestFilters = {}) => listGuests(filters))
export const getGuestProfile = cache((guestId: string) => guestProfile(guestId))
export const canManageGuests = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'guest:manage')
})

/** Detalhe administrativo de uma reserva — precisa da pousada ativa para escopar (nunca confia só no id). */
export const getOwnerReservationDetail = cache(async (bookingId: string) => {
  const { pousadaId } = await requireCapability('booking:manage')
  return getBookingDetailById(bookingId, pousadaId)
})
export const canManageBookings = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'booking:manage')
})

/**
 * Ficha FNRH (impressão) de uma reserva — dados da reserva + hóspede
 * responsável + acompanhantes + identificação da pousada para o cabeçalho.
 * Mesma barreira de `getOwnerReservationDetail` (`booking:manage`): quem
 * confere a reserva também pode imprimir a ficha de check-in.
 */
export const getBookingFnrh = cache(async (bookingId: string) => {
  const { pousadaId } = await requireCapability('booking:manage')
  const [data, settings] = await Promise.all([
    getBookingFnrhData(bookingId, pousadaId),
    getPousadaSettings(pousadaId),
  ])
  if (!data) return null
  return {
    ...data,
    pousada: {
      name: settings?.name ?? 'Pousada',
      legalName: settings?.legalName || settings?.name || 'Pousada',
      taxId: settings?.taxId ?? '',
      address: settings?.address ?? '',
      cep: settings?.cep ?? '',
      city: settings?.city ?? '',
      state: settings?.state ?? '',
      checkinTime: settings?.checkinTime ?? '',
      checkoutTime: settings?.checkoutTime ?? '',
    },
  }
})

/** Canais (iCal) da pousada ativa — quem vê é definido por `channel:view`. */
export const getOwnerChannels = cache(() => ownerChannels())
export const canManageChannels = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'channel:manage')
})

/** Link da bio: relatório e pedidos de orçamento da pousada ativa. */
export const getLinkReport = cache((days: 7 | 30 | 90 = 30) => linkReport({ days }))
export const getQuoteRequests = cache(() => quoteRequests())
export const canManageQuotes = cache(async () => {
  const state = await resolveTenantAccess()
  return state.status === 'ok' && can(state.membership.role, 'quote:manage')
})

/** Favoritos do visitante autenticado. */
export const isFavoritePousada = cache((slug: string) => getFavoriteState(slug))
export const getMyFavorites = cache(() => listMyFavorites())
export const getMyFavoriteAlertStates = cache(() => listMyFavoriteAlertStates())
