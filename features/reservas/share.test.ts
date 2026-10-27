import { describe, expect, it } from 'vitest'
import {
  isShareToken,
  parseSharedTrip,
  shareTripMessage,
  sharedTripPath,
  tripMapsUrl,
  whatsappShareUrl,
} from './share'

// Dados sintéticos.
const raw = {
  status: 'confirmed',
  code: 'RP-ABC123',
  checkin: '2026-11-14',
  checkout: '2026-11-17',
  pousadaName: 'Pousada Teste',
  address: 'Rua das Flores, 10',
  cep: '36325-000',
  city: 'Tiradentes',
  state: 'MG',
  checkinTime: '15:00',
  checkoutTime: '11:00',
}

describe('parseSharedTrip', () => {
  it('lê só os campos de viagem', () => {
    const trip = parseSharedTrip({ ...raw, total: 999, guestEmail: 'x@example.test' })
    expect(trip).toEqual(raw)
    expect(trip && 'total' in trip).toBe(false)
  })

  it('cancelada não carrega detalhe nenhum', () => {
    expect(parseSharedTrip({ status: 'cancelled', code: 'RP-1' })).toEqual({ status: 'cancelled' })
  })

  it('resposta vazia ou estranha = link inválido', () => {
    expect(parseSharedTrip(null)).toBeNull()
    expect(parseSharedTrip({ status: 'outro' })).toBeNull()
    expect(parseSharedTrip({ status: 'confirmed' })).toBeNull()
  })
})

describe('link e mensagem', () => {
  it('token no formato do banco', () => {
    expect(isShareToken('a'.repeat(43))).toBe(true)
    expect(isShareToken('abc')).toBe(false)
    expect(isShareToken(`${'a'.repeat(42)}/`)).toBe(false)
  })

  it('caminho público fora da área logada', () => {
    expect(sharedTripPath('tok')).toBe('/viagem/tok')
  })

  it('como chegar pelo endereço', () => {
    expect(tripMapsUrl(raw)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Pousada Teste, Rua das Flores, 10, Tiradentes, MG')}`,
    )
    expect(tripMapsUrl({ ...raw, address: ' ' })).toContain(
      encodeURIComponent('Pousada Teste, Tiradentes, MG'),
    )
  })

  it('mensagem do WhatsApp sem valores', () => {
    const message = shareTripMessage({ ...raw, url: 'https://rota.example.test/viagem/tok' })
    expect(message).toBe(
      'Nossa hospedagem na Pousada Teste, de 14/11/2026 a 17/11/2026. Endereço, horários e código da reserva: https://rota.example.test/viagem/tok',
    )
    expect(whatsappShareUrl(message)).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`)
  })
})
