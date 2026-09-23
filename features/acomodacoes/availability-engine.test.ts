import { describe, it, expect } from 'vitest'
import { evaluateRoomAvailability, rangesOverlap, validateDateRange } from './availability-engine'
import type { AvailabilityInput } from './availability-engine'

function baseInput(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    roomStatus: 'active',
    categoryStatus: 'active',
    operationalStatus: 'available',
    capacityMax: 4,
    petsAllowed: false,
    requestedAdults: 2,
    requestedChildren: 0,
    requestedPets: false,
    hasBlockConflict: false,
    hasBookingConflict: false,
    ...overrides,
  }
}

describe('evaluateRoomAvailability', () => {
  it('disponível quando nada impede', () => {
    expect(evaluateRoomAvailability(baseInput())).toEqual([])
  })

  it('indisponível por acomodação inativa', () => {
    expect(evaluateRoomAvailability(baseInput({ roomStatus: 'inactive' }))).toContain(
      'inactive_room',
    )
  })

  it('indisponível por categoria inativa', () => {
    expect(evaluateRoomAvailability(baseInput({ categoryStatus: 'inactive' }))).toContain(
      'inactive_category',
    )
  })

  it('categoria nula não gera motivo de categoria', () => {
    expect(evaluateRoomAvailability(baseInput({ categoryStatus: null }))).not.toContain(
      'inactive_category',
    )
  })

  it('indisponível por capacidade insuficiente', () => {
    const reasons = evaluateRoomAvailability(baseInput({ capacityMax: 2, requestedAdults: 3 }))
    expect(reasons).toContain('insufficient_capacity')
  })

  it('capacidade exata no limite é válida (sem motivo)', () => {
    const reasons = evaluateRoomAvailability(
      baseInput({ capacityMax: 3, requestedAdults: 2, requestedChildren: 1 }),
    )
    expect(reasons).not.toContain('insufficient_capacity')
  })

  it('indisponível por não aceitar pets quando solicitado', () => {
    const reasons = evaluateRoomAvailability(baseInput({ petsAllowed: false, requestedPets: true }))
    expect(reasons).toContain('pets_not_allowed')
  })

  it('pet não solicitado não gera motivo mesmo se a acomodação não aceita', () => {
    const reasons = evaluateRoomAvailability(
      baseInput({ petsAllowed: false, requestedPets: false }),
    )
    expect(reasons).not.toContain('pets_not_allowed')
  })

  it('status operacional "maintenance" bloqueia', () => {
    expect(evaluateRoomAvailability(baseInput({ operationalStatus: 'maintenance' }))).toContain(
      'operational_status_blocking',
    )
  })

  it('status operacional "blocked" bloqueia', () => {
    expect(evaluateRoomAvailability(baseInput({ operationalStatus: 'blocked' }))).toContain(
      'operational_status_blocking',
    )
  })

  it('status operacional transitório ("occupied"/"cleaning") NÃO bloqueia disponibilidade futura', () => {
    expect(evaluateRoomAvailability(baseInput({ operationalStatus: 'occupied' }))).not.toContain(
      'operational_status_blocking',
    )
    expect(evaluateRoomAvailability(baseInput({ operationalStatus: 'cleaning' }))).not.toContain(
      'operational_status_blocking',
    )
  })

  it('indisponível por bloqueio no período', () => {
    expect(evaluateRoomAvailability(baseInput({ hasBlockConflict: true }))).toContain(
      'blocked_period',
    )
  })

  it('indisponível por reserva conflitante', () => {
    expect(evaluateRoomAvailability(baseInput({ hasBookingConflict: true }))).toContain(
      'booking_conflict',
    )
  })

  it('acumula múltiplos motivos simultâneos', () => {
    const reasons = evaluateRoomAvailability(
      baseInput({
        roomStatus: 'inactive',
        capacityMax: 1,
        requestedAdults: 5,
        hasBlockConflict: true,
      }),
    )
    expect(reasons).toEqual(
      expect.arrayContaining(['inactive_room', 'insufficient_capacity', 'blocked_period']),
    )
  })
})

describe('rangesOverlap (intervalo semiaberto [início, fim))', () => {
  it('detecta sobreposição real', () => {
    expect(rangesOverlap('2026-01-10', '2026-01-15', '2026-01-12', '2026-01-18')).toBe(true)
  })

  it('não detecta conflito quando um intervalo termina exatamente onde o outro começa', () => {
    expect(rangesOverlap('2026-01-10', '2026-01-15', '2026-01-15', '2026-01-20')).toBe(false)
    expect(rangesOverlap('2026-01-15', '2026-01-20', '2026-01-10', '2026-01-15')).toBe(false)
  })

  it('detecta um intervalo totalmente contido no outro', () => {
    expect(rangesOverlap('2026-01-10', '2026-01-20', '2026-01-12', '2026-01-14')).toBe(true)
  })

  it('não detecta conflito para intervalos totalmente separados', () => {
    expect(rangesOverlap('2026-01-01', '2026-01-05', '2026-02-01', '2026-02-05')).toBe(false)
  })
})

describe('validateDateRange', () => {
  it('rejeita entrada igual à saída', () => {
    expect(validateDateRange('2026-01-10', '2026-01-10')).toBe(false)
  })

  it('rejeita saída anterior à entrada', () => {
    expect(validateDateRange('2026-01-15', '2026-01-10')).toBe(false)
  })

  it('aceita intervalo válido', () => {
    expect(validateDateRange('2026-01-10', '2026-01-15')).toBe(true)
  })
})
