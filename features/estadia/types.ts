import type { InventoryCategory } from '@/features/estoque/labels'

export type StayMenuItem = {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  price: number
  description: string
  photoUrl: string | null
  available: boolean
  maxQuantity: number
}

export type GuestStay = {
  booking: {
    id: string
    code: string
    status: string
    checkin: string
    checkout: string
    adults: number
    children: number
    roomName: string
    total: number
    balanceDue: number
  }
  pousada: {
    id: string
    name: string
    slug: string
    image: string | null
    address: string
    city: string
    state: string
    cep: string
    whatsapp: string
    phone: string
    checkinTime: string
    checkoutTime: string
    houseRules: string
    cancellationPolicy: string
  }
  info: { wifiName: string; wifiPassword: string; guestInfo: string; ordersHours: string }
  today: string
  canOrder: boolean
  ordersEnabled: boolean
  canReview: boolean
  reviewed: boolean
  consumption: { delivered: number; open: number; paid: number; balance: number }
  menu: StayMenuItem[]
}

/** Converte o JSON da RPC `get_guest_stay` (números podem vir como string). */
export function parseGuestStay(raw: unknown): GuestStay {
  const r = raw as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = (v: unknown) => (v == null ? '' : String(v))
  const n = (v: unknown) => Number(v) || 0
  const delivered = n(r.consumption?.delivered)
  const paid = n(r.consumption?.paid)
  return {
    booking: {
      id: s(r.booking.id),
      code: s(r.booking.code),
      status: s(r.booking.status),
      checkin: s(r.booking.checkin),
      checkout: s(r.booking.checkout),
      adults: n(r.booking.adults),
      children: n(r.booking.children),
      roomName: s(r.booking.roomName) || 'Acomodação',
      total: n(r.booking.total),
      balanceDue: n(r.booking.balanceDue),
    },
    pousada: {
      id: s(r.pousada.id),
      name: s(r.pousada.name),
      slug: s(r.pousada.slug),
      image: r.pousada.image ? s(r.pousada.image) : null,
      address: s(r.pousada.address),
      city: s(r.pousada.city),
      state: s(r.pousada.state),
      cep: s(r.pousada.cep),
      whatsapp: s(r.pousada.whatsapp),
      phone: s(r.pousada.phone),
      checkinTime: s(r.pousada.checkinTime) || '14:00',
      checkoutTime: s(r.pousada.checkoutTime) || '12:00',
      houseRules: s(r.pousada.houseRules),
      cancellationPolicy: s(r.pousada.cancellationPolicy),
    },
    info: {
      wifiName: s(r.info?.wifiName),
      wifiPassword: s(r.info?.wifiPassword),
      guestInfo: s(r.info?.guestInfo),
      ordersHours: s(r.info?.ordersHours),
    },
    today: s(r.today),
    canOrder: !!r.canOrder,
    ordersEnabled: r.ordersEnabled !== false,
    canReview: !!r.canReview,
    reviewed: !!r.reviewed,
    consumption: {
      delivered,
      open: n(r.consumption?.open),
      paid,
      balance: Math.max(0, delivered - paid),
    },
    menu: (Array.isArray(r.menu) ? r.menu : []).map((m: Record<string, unknown>) => ({
      id: s(m.id),
      name: s(m.name),
      category: s(m.category) as InventoryCategory,
      unit: s(m.unit),
      price: n(m.price),
      description: s(m.description),
      photoUrl: m.photoUrl ? s(m.photoUrl) : null,
      available: !!m.available,
      maxQuantity: Math.max(0, Math.min(20, n(m.maxQuantity))),
    })),
  }
}
