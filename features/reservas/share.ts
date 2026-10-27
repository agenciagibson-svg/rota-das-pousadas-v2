/**
 * "Enviar para quem vai comigo" (h9): link só de leitura da reserva (0094).
 *
 * O link mostra apenas pousada, endereço/como chegar, datas, horários e o
 * código. Nunca valores, documento, e-mail, telefone ou outros hóspedes — o
 * corte é do banco (`get_shared_booking`); aqui só se lê o que veio.
 */
import { formatISODate } from '@/lib/format'

/** Mesmo formato que o banco aceita (0094). */
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/

export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_RE.test(value)
}

export type SharedTripDetails = {
  status: 'pending' | 'confirmed' | 'finished'
  code: string
  checkin: string
  checkout: string
  pousadaName: string
  address: string
  cep: string
  city: string
  state: string
  checkinTime: string
  checkoutTime: string
}

export type SharedTrip = { status: 'cancelled' } | SharedTripDetails

const str = (value: unknown) => (typeof value === 'string' ? value : '')

/** JSON da RPC → viagem. Qualquer coisa fora do esperado vira `null` (link inválido). */
export function parseSharedTrip(value: unknown): SharedTrip | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.status === 'cancelled') return { status: 'cancelled' }
  if (raw.status !== 'pending' && raw.status !== 'confirmed' && raw.status !== 'finished') {
    return null
  }
  if (!str(raw.code) || !str(raw.checkin) || !str(raw.checkout)) return null
  return {
    status: raw.status,
    code: str(raw.code),
    checkin: str(raw.checkin),
    checkout: str(raw.checkout),
    pousadaName: str(raw.pousadaName) || 'Pousada',
    address: str(raw.address),
    cep: str(raw.cep),
    city: str(raw.city),
    state: str(raw.state),
    checkinTime: str(raw.checkinTime),
    checkoutTime: str(raw.checkoutTime),
  }
}

/** "Como chegar": busca no Google Maps pelo endereço (ou nome + cidade sem endereço). */
export function tripMapsUrl(t: {
  pousadaName: string
  address: string
  city: string
  state: string
}): string {
  const query = [
    t.address.trim() ? `${t.pousadaName}, ${t.address}` : t.pousadaName,
    t.city,
    t.state,
  ]
    .filter(Boolean)
    .join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Texto pronto para o WhatsApp. */
export function shareTripMessage(t: {
  pousadaName: string
  checkin: string
  checkout: string
  url: string
}): string {
  return (
    `Nossa hospedagem na ${t.pousadaName}, de ${formatISODate(t.checkin)} a ${formatISODate(t.checkout)}. ` +
    `Endereço, horários e código da reserva: ${t.url}`
  )
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/** Caminho público do link (fora de /minhas-reservas, que exige login). */
export function sharedTripPath(token: string): string {
  return `/viagem/${token}`
}
