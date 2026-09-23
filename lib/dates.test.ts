import { describe, it, expect } from 'vitest'
import { DEFAULT_TIMEZONE, isoDateInTimeZone, isValidTimeZone } from './dates'

// 23/09/2026 22:30 em Brasília = 24/09/2026 01:30 UTC.
const NIGHT_IN_BRASILIA = new Date('2026-09-24T01:30:00Z')

describe('isoDateInTimeZone', () => {
  it('usa a data do fuso, não a de UTC (depois das 21h ainda é hoje no Brasil)', () => {
    expect(NIGHT_IN_BRASILIA.toISOString().slice(0, 10)).toBe('2026-09-24')
    expect(isoDateInTimeZone(NIGHT_IN_BRASILIA, 'America/Sao_Paulo')).toBe('2026-09-23')
  })

  it('respeita outros fusos do Brasil', () => {
    // 01:30 UTC = 21:30 do dia 23 em Manaus (UTC-4).
    expect(isoDateInTimeZone(NIGHT_IN_BRASILIA, 'America/Manaus')).toBe('2026-09-23')
    // 04:30 UTC = 23:30 do dia 23 em Rio Branco (UTC-5) e 01:30 do dia 24 em Noronha (UTC-2).
    const late = new Date('2026-09-24T04:30:00Z')
    expect(isoDateInTimeZone(late, 'America/Rio_Branco')).toBe('2026-09-23')
    expect(isoDateInTimeZone(late, 'America/Noronha')).toBe('2026-09-24')
  })

  it('usa Brasília por padrão e quando o fuso gravado não existe', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Sao_Paulo')
    expect(isoDateInTimeZone(NIGHT_IN_BRASILIA)).toBe('2026-09-23')
    expect(isoDateInTimeZone(NIGHT_IN_BRASILIA, 'Brasília')).toBe('2026-09-23')
    expect(isoDateInTimeZone(NIGHT_IN_BRASILIA, '')).toBe('2026-09-23')
  })
})

describe('isValidTimeZone', () => {
  it('aceita nomes IANA e recusa texto livre', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true)
    expect(isValidTimeZone('America/Manaus')).toBe(true)
    expect(isValidTimeZone('Brasília')).toBe(false)
    expect(isValidTimeZone('GMT-3 Brasília')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})
