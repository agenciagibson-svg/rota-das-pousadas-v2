import type { SessionUser } from './types'
import type { Booking } from '@/features/reservas/types'
import { isoDateInTimeZone } from '@/lib/dates'

/**
 * Resumo do usuário logado para o cabeçalho do site (menu do usuário e ícone
 * de viagens). Função pura — a rota /api/me/header só junta os dados.
 */
export type HeaderTrip = {
  id: string
  code: string
  pousadaName: string
  pousadaSlug: string
  checkin: string
  checkout: string
  total: number
  paymentDueAt: string | null
  /** 0075: comprovante de Pix enviado, esperando a pousada aprovar. */
  awaitingApproval?: boolean
}

export type HeaderSummary =
  | { user: null }
  | {
      user: {
        firstName: string
        fullName: string
        email: string
        initials: string
        hasPousadaAccess: boolean
        isPlatformStaff: boolean
      }
      pendingTrips: HeaderTrip[]
      nextTrip: HeaderTrip | null
    }

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (email[0] ?? '?').toUpperCase()
}

function toTrip(b: Booking): HeaderTrip {
  return {
    id: b.id,
    code: b.code,
    pousadaName: b.pousadaName,
    pousadaSlug: b.pousadaSlug,
    checkin: b.checkin,
    checkout: b.checkout,
    total: b.balanceDue > 0 ? b.balanceDue : b.total,
    paymentDueAt: b.paymentDueAt,
    ...(b.awaitingPixApproval ? { awaitingApproval: true } : {}),
  }
}

export function buildHeaderSummary(
  user: SessionUser | null,
  bookings: Booking[],
  now: Date = new Date(),
): HeaderSummary {
  if (!user) return { user: null }
  const fullName = user.name?.trim() || ''
  const firstName = fullName.split(/\s+/)[0] || user.email.split('@')[0]
  const today = isoDateInTimeZone(now)

  const pendingTrips = bookings
    .filter(
      (b) =>
        b.status === 'pending' &&
        (!b.paymentDueAt || new Date(b.paymentDueAt).getTime() > now.getTime()),
    )
    .sort((a, b) => (a.paymentDueAt ?? '9999').localeCompare(b.paymentDueAt ?? '9999'))
    .map(toTrip)

  const next = bookings
    .filter((b) => (b.status === 'confirmed' || b.status === 'checked_in') && b.checkout >= today)
    .sort((a, b) => a.checkin.localeCompare(b.checkin))[0]

  return {
    user: {
      firstName,
      fullName: fullName || firstName,
      email: user.email,
      initials: initialsOf(fullName, user.email),
      hasPousadaAccess: user.memberships.some((m) => m.status === 'active'),
      isPlatformStaff: user.platformRole !== null,
    },
    pendingTrips,
    nextTrip: next ? toTrip(next) : null,
  }
}
