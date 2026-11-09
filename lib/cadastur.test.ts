import { describe, expect, it } from 'vitest'
import {
  cadasturFromColumns,
  cadasturStatus,
  isValidCadasturNumber,
  showCadasturSeal,
  todayIso,
} from './cadastur'

describe('Cadastur', () => {
  it('aceita o número como vem no certificado, com pontos e traço', () => {
    expect(isValidCadasturNumber('26.012345.10.0001-6')).toBe(true)
    expect(isValidCadasturNumber('  31012345100001  ')).toBe(true)
  })

  it('recusa texto, poucos ou dígitos demais', () => {
    expect(isValidCadasturNumber('')).toBe(false)
    expect(isValidCadasturNumber('abc12345678')).toBe(false)
    expect(isValidCadasturNumber('1234-567')).toBe(false)
    expect(isValidCadasturNumber('1'.repeat(21))).toBe(false)
  })

  it('selo só para cadastro informado e não vencido', () => {
    const hoje = '2026-11-09'
    expect(showCadasturSeal(null, hoje)).toBe(false)
    expect(showCadasturSeal({ number: '26.012345.10.0001-6', validUntil: null }, hoje)).toBe(true)
    expect(showCadasturSeal({ number: '26.012345.10.0001-6', validUntil: hoje }, hoje)).toBe(true)
    expect(cadasturStatus({ number: '26.012345.10.0001-6', validUntil: '2026-11-08' }, hoje)).toBe(
      'vencido',
    )
  })

  it('coluna vazia vira "sem cadastro"', () => {
    expect(cadasturFromColumns('', null)).toBeNull()
    expect(cadasturFromColumns('  ', '2027-01-01')).toBeNull()
    expect(cadasturFromColumns('26.0123', '')).toEqual({ number: '26.0123', validUntil: null })
  })

  it('"hoje" respeita o fuso de Brasília', () => {
    // 02:00 UTC de 10/11 ainda é 09/11 em Brasília.
    expect(todayIso('America/Sao_Paulo', new Date('2026-11-10T02:00:00Z'))).toBe('2026-11-09')
  })
})
