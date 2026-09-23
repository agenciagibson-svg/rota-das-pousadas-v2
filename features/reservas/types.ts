/**
 * [Ciclo 4] Vocabulário recriado do zero (0032_bookings_evolution.sql) — a
 * tabela não tinha nenhuma linha real no momento da migração, então não há
 * valor antigo (iniciada/aguardando_pagamento/...) sobrevivendo em produção.
 */
export type BookingStatus =
  'quote' | 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'

export type BookingOrigin =
  | 'rota_das_pousadas'
  | 'site_proprio'
  | 'whatsapp'
  | 'telefone'
  | 'balcao'
  | 'booking_com'
  | 'airbnb'
  | 'expedia'
  | 'agencia'
  | 'outro'

/** Detalhamento de preço de uma reserva (valores em reais inteiros). */
export type PriceBreakdown = {
  nights: number
  nightly: number
  subtotal: number
  fee: number
  discount: number
  surcharge: number
  servicesAmount: number
  total: number
}

/** Reserva enriquecida com dados da pousada, para exibição ao hóspede (/minhas-reservas). */
export type Booking = {
  id: string
  code: string
  pousadaSlug: string
  pousadaName: string
  pousadaImage: string
  roomName: string
  city: string
  state: string
  checkin: string
  checkout: string
  guests: number
  nights: number
  subtotal: number
  fee: number
  discount: number
  surcharge: number
  total: number
  balanceDue: number
  status: BookingStatus
  paymentDueAt: string | null
  cancellationReason: string | null
  createdAt: string
}

export type BookingCompanion = {
  id: string
  guestId: string | null
  fullName: string
  guestType: 'responsible' | 'adult' | 'child' | 'infant'
  hasSpecialNeeds: boolean
  birthDate: string | null
  documentType: string | null
  documentNumber: string | null
  operationalNotes: string
}

/** Um acompanhante na ficha FNRH — só os campos que a ficha imprime. */
export type FnrhCompanion = {
  fullName: string
  guestType: BookingCompanion['guestType']
  documentType: string | null
  documentNumber: string | null
  birthDate: string | null
}

/**
 * Dados para a Ficha Nacional de Registro de Hóspedes (impressão).
 * Só projeta o que já está cadastrado — campos que o negócio não rastreia
 * hoje (profissão, procedência, destino, meio de transporte, placa) ficam em
 * branco na ficha impressa, para preenchimento manual no check-in.
 */
export type FnrhData = {
  pousada: {
    name: string
    legalName: string
    taxId: string
    address: string
    cep: string
    city: string
    state: string
    checkinTime: string
    checkoutTime: string
  }
  booking: {
    code: string
    roomName: string
    checkin: string
    checkout: string
    nights: number
    adults: number
    children: number
    infants: number
  }
  responsible: {
    fullName: string
    email: string | null
    phone: string | null
    documentType: string | null
    documentNumber: string | null
    birthDate: string | null
    nationality: string | null
    country: string | null
    city: string | null
    state: string | null
    address: string | null
    cep: string | null
  }
  companions: FnrhCompanion[]
}

/** Reserva completa, visão administrativa (/dashboard/reservas/[id]). */
export type BookingDetail = {
  id: string
  code: string
  pousadaId: string
  roomId: string
  roomName: string
  responsibleGuestId: string
  guestName: string
  guestEmail: string | null
  guestPhone: string | null
  travelerUserId: string | null
  checkin: string
  checkout: string
  nights: number
  adults: number
  children: number
  infants: number
  pets: boolean
  status: BookingStatus
  origin: BookingOrigin
  externalChannelName: string | null
  externalCode: string | null
  subtotal: number
  fee: number
  discount: number
  surcharge: number
  servicesAmount: number
  total: number
  amountReceived: number
  balanceDue: number
  currency: string
  expectedArrivalTime: string | null
  specialRequests: string
  internalNotes: string
  cancellationReason: string | null
  cancelledAt: string | null
  noShowReason: string | null
  noShowAt: string | null
  paymentDueAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  companions: BookingCompanion[]
}
