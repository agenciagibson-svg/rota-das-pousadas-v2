import type { GeoPoint } from '@/types'
import type { BookingOrigin, BookingStatus } from '@/features/reservas/types'

/** Reserva na visão do proprietário. */
export type OwnerReservation = {
  id: string
  code: string
  guestName: string
  guestEmail: string
  /** Telefone/WhatsApp da reserva ou da ficha do hóspede. */
  guestPhone?: string | null
  roomName: string
  checkin: string
  checkout: string
  nights: number
  guests: number
  subtotal: number
  fee: number
  total: number
  balanceDue: number
  status: BookingStatus
  origin: BookingOrigin
  paymentDueAt: string | null
  createdAt: string
  /** Pendente com prazo de pagamento vencido — nunca expira sozinha (RB seção 9); só sinaliza para ação explícita. */
  needsAttention: boolean
  /** 0075: hóspede enviou comprovante de Pix direto — falta a equipe aprovar. */
  proofPending?: boolean
  /** 0088: hóspede já enviou o pré-check-in (`bookings.precheckin_completed_at`). */
  precheckinDone: boolean
}

/** Pousada gerida pelo usuário atual. */
export type ManagedPousada = {
  id: string
  slug: string
  name: string
  status: string
  roomId: string
  /** Fuso IANA da pousada (`pousadas.timezone`) — define o "hoje" do painel. */
  timezone: string
}

export type OwnerPousadaSettings = {
  id: string
  slug: string
  name: string
  legalName: string
  taxId: string
  city: string
  state: string
  country: string
  address: string
  cep: string
  image: string
  /** Fotos da vitrine (a capa primeiro). */
  gallery: string[]
  description: string
  tags: string[]
  timezone: string
  currency: string
  language: string
  checkinTime: string
  checkoutTime: string
  contactPhone: string
  whatsapp: string
  notificationEmail: string
  houseRules: string
  cancellationPolicy: string
  /** Ponto marcado no mapa (0095); `null` enquanto o dono não marcar. */
  location: GeoPoint | null
}

export type OwnerReview = {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  rating: number
  text: string
  response: string | null
  checkin: string | null
  checkout: string | null
  createdAt: string
}
