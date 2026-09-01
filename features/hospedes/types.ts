export type GuestSource = 'platform_account' | 'front_desk' | 'owner' | 'public_booking' | 'import' | 'other'

export type EmergencyContact = {
  name?: string
  phone?: string
}

/** Hóspede na listagem — documento sempre mascarado, nunca a observação interna completa exposta fora do perfil. */
export type GuestListItem = {
  id: string
  fullName: string
  preferredName: string | null
  email: string | null
  phone: string | null
  city: string | null
  documentMasked: string | null
  bookingsCount: number
  lastBookingAt: string | null
  isIncomplete: boolean
  createdAt: string
}

export type GuestBookingSummary = {
  id: string
  code: string
  roomName: string
  checkin: string
  checkout: string
  status: string
  total: number
}

/** Perfil completo — só para quem tem `guest:manage` (nunca a área pública). */
export type GuestDetail = {
  id: string
  pousadaId: string
  userId: string | null
  fullName: string
  preferredName: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  documentType: string | null
  documentNumber: string | null
  birthDate: string | null
  nationality: string | null
  country: string | null
  city: string | null
  state: string | null
  address: string | null
  emergencyContact: EmergencyContact
  preferences: string[]
  dietaryRestrictions: string
  accessibilityNeeds: string
  internalNotes: string
  marketingConsent: boolean
  source: GuestSource
  createdAt: string
  updatedAt: string
  bookings: GuestBookingSummary[]
}
