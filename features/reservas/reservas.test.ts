import { describe, it, expect } from 'vitest'
import { calculateBookingPrice, nightsBetween, SERVICE_FEE_RATE } from './pricing'
import { createBookingSchema, createBookingAdminSchema, updateBookingSchema } from './schemas'
import { canTransition, isFinalStatus, isOccupyingStatus } from './status'

describe('nightsBetween', () => {
  it('conta as noites corretamente', () => {
    expect(nightsBetween('2026-03-14', '2026-03-16')).toBe(2)
    expect(nightsBetween('2026-03-14', '2026-03-15')).toBe(1)
  })
  it('nunca retorna negativo', () => {
    expect(nightsBetween('2026-03-16', '2026-03-14')).toBe(0)
  })
})

describe('calculateBookingPrice', () => {
  it('aplica diária × noites + taxa de 8%', () => {
    const p = calculateBookingPrice(720, '2026-03-14', '2026-03-16')
    expect(p.nights).toBe(2)
    expect(p.subtotal).toBe(1440)
    expect(p.fee).toBe(Math.round(1440 * SERVICE_FEE_RATE))
    expect(p.total).toBe(p.subtotal + p.fee)
  })
  it('zera com período inválido', () => {
    const p = calculateBookingPrice(720, '2026-03-16', '2026-03-14')
    expect(p.nights).toBe(0)
    expect(p.total).toBe(0)
  })
  it('[Ciclo 4] aplica desconto, acréscimo e serviços previstos', () => {
    const p = calculateBookingPrice(720, '2026-03-14', '2026-03-16', { discount: 100, surcharge: 50, servicesAmount: 30 })
    expect(p.subtotal).toBe(1440)
    expect(p.discount).toBe(100)
    expect(p.surcharge).toBe(50)
    expect(p.servicesAmount).toBe(30)
    expect(p.total).toBe(p.subtotal + p.fee - 100 + 50 + 30)
  })
  it('[Ciclo 4] nunca aceita ajuste negativo (RB seção 5)', () => {
    const p = calculateBookingPrice(720, '2026-03-14', '2026-03-16', { discount: -50, surcharge: -10 })
    expect(p.discount).toBe(0)
    expect(p.surcharge).toBe(0)
  })
  it('[Ciclo 4] total nunca fica negativo mesmo com desconto maior que o subtotal', () => {
    const p = calculateBookingPrice(100, '2026-03-14', '2026-03-15', { discount: 10_000 })
    expect(p.total).toBe(0)
  })
})

describe('[Ciclo 4] canTransition — espelha a tabela reimplementada em set_booking_status (0034)', () => {
  it('permite as transições pré-check-in aprovadas', () => {
    expect(canTransition('quote', 'pending')).toBe(true)
    expect(canTransition('quote', 'confirmed')).toBe(true)
    expect(canTransition('quote', 'cancelled')).toBe(true)
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('pending', 'cancelled')).toBe(true)
    expect(canTransition('confirmed', 'cancelled')).toBe(true)
    expect(canTransition('confirmed', 'no_show')).toBe(true)
  })
  it('rejeita transições fora da lista aprovada', () => {
    expect(canTransition('confirmed', 'pending')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
    expect(canTransition('no_show', 'confirmed')).toBe(false)
    expect(canTransition('quote', 'checked_in')).toBe(false)
    expect(canTransition('checked_out', 'cancelled')).toBe(false)
  })
})

describe('[Ciclo 4] isFinalStatus / isOccupyingStatus', () => {
  it('status finais não podem ser editados livremente', () => {
    expect(isFinalStatus('cancelled')).toBe(true)
    expect(isFinalStatus('no_show')).toBe(true)
    expect(isFinalStatus('checked_out')).toBe(true)
    expect(isFinalStatus('confirmed')).toBe(false)
    expect(isFinalStatus('quote')).toBe(false)
  })
  it('só pending/confirmed/checked_in bloqueiam inventário — quote nunca bloqueia', () => {
    expect(isOccupyingStatus('pending')).toBe(true)
    expect(isOccupyingStatus('confirmed')).toBe(true)
    expect(isOccupyingStatus('checked_in')).toBe(true)
    expect(isOccupyingStatus('quote')).toBe(false)
    expect(isOccupyingStatus('cancelled')).toBe(false)
    expect(isOccupyingStatus('no_show')).toBe(false)
  })
})

describe('[Ciclo 4] createBookingAdminSchema', () => {
  const base = {
    roomId: '11111111-1111-1111-1111-111111111111',
    checkin: '2026-03-14',
    checkout: '2026-03-16',
    adults: 2,
    children: 0,
    infants: 0,
    pets: false,
    guestFullName: 'Maria Teste',
    guestEmail: '',
    guestPhone: '',
    origin: 'balcao' as const,
    externalChannelName: '',
    externalCode: '',
    nightlyRate: 300,
    discount: 0,
    surcharge: 0,
    servicesAmount: 0,
    expectedArrivalTime: '',
    specialRequests: '',
    internalNotes: '',
    initialStatus: 'quote' as const,
  }
  it('aceita reserva administrativa válida', () => {
    expect(createBookingAdminSchema.safeParse(base).success).toBe(true)
  })
  it('rejeita sem nome do hóspede responsável', () => {
    expect(createBookingAdminSchema.safeParse({ ...base, guestFullName: '' }).success).toBe(false)
  })
  it('rejeita checkout antes do checkin', () => {
    expect(createBookingAdminSchema.safeParse({ ...base, checkin: '2026-03-16', checkout: '2026-03-14' }).success).toBe(false)
  })
})

describe('[Ciclo 4] updateBookingSchema exige version (concorrência otimista)', () => {
  it('rejeita sem version', () => {
    const { version: _version, ...withoutVersion } = {
      bookingId: '11111111-1111-1111-1111-111111111111',
      version: 1,
      roomId: '11111111-1111-1111-1111-111111111111',
      guestId: '11111111-1111-1111-1111-111111111111',
      checkin: '2026-03-14',
      checkout: '2026-03-16',
      adults: 2,
      children: 0,
      infants: 0,
      pets: false,
      nightlyRate: 300,
      discount: 0,
      surcharge: 0,
      servicesAmount: 0,
      origin: 'balcao' as const,
      expectedArrivalTime: '',
      specialRequests: '',
      internalNotes: '',
    }
    expect(updateBookingSchema.safeParse(withoutVersion).success).toBe(false)
  })
})

describe('createBookingSchema', () => {
  const future = new Date(Date.now() + 86_400_000 * 10).toISOString().slice(0, 10)
  const later = new Date(Date.now() + 86_400_000 * 12).toISOString().slice(0, 10)

  it('aceita reserva válida', () => {
    const r = createBookingSchema.safeParse({ pousadaSlug: 'x', checkin: future, checkout: later, guests: 2 })
    expect(r.success).toBe(true)
  })
  it('rejeita checkout antes do checkin', () => {
    const r = createBookingSchema.safeParse({ pousadaSlug: 'x', checkin: later, checkout: future, guests: 2 })
    expect(r.success).toBe(false)
  })
  it('rejeita data no passado', () => {
    const r = createBookingSchema.safeParse({ pousadaSlug: 'x', checkin: '2020-01-01', checkout: '2020-01-03', guests: 2 })
    expect(r.success).toBe(false)
  })
  it('coage e valida hóspedes', () => {
    const r = createBookingSchema.safeParse({ pousadaSlug: 'x', checkin: future, checkout: later, guests: '3' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.guests).toBe(3)
  })
})
