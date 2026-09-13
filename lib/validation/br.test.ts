import { describe, it, expect } from 'vitest'
import { ufSchema, phoneSchema, cepSchema } from './br'

describe('ufSchema', () => {
  it('aceita UF real, maiúscula ou minúscula', () => {
    expect(ufSchema.safeParse('MG').success).toBe(true)
    expect(ufSchema.safeParse('mg').success).toBe(true)
    expect(ufSchema.safeParse('DF').success).toBe(true)
  })
  it('não altera o valor original (sem transform)', () => {
    const result = ufSchema.safeParse('mg')
    expect(result.success && result.data).toBe('mg')
  })
  it('rejeita sigla inexistente ou tamanho errado', () => {
    expect(ufSchema.safeParse('XX').success).toBe(false)
    expect(ufSchema.safeParse('MGX').success).toBe(false)
    expect(ufSchema.safeParse('').success).toBe(false)
  })
})

describe('phoneSchema', () => {
  it('aceita com e sem máscara', () => {
    expect(phoneSchema.safeParse('11999998888').success).toBe(true)
    expect(phoneSchema.safeParse('(11) 99999-8888').success).toBe(true)
    expect(phoneSchema.safeParse('11 3456-7890').success).toBe(true)
  })
  it('rejeita sem DDD ou com dígitos de menos/mais', () => {
    expect(phoneSchema.safeParse('999998888').success).toBe(false)
    expect(phoneSchema.safeParse('119999888').success).toBe(false)
    expect(phoneSchema.safeParse('abc').success).toBe(false)
  })
})

describe('cepSchema', () => {
  it('aceita com e sem hífen', () => {
    expect(cepSchema.safeParse('01310-100').success).toBe(true)
    expect(cepSchema.safeParse('01310100').success).toBe(true)
  })
  it('rejeita formato errado', () => {
    expect(cepSchema.safeParse('123').success).toBe(false)
    expect(cepSchema.safeParse('01310-10').success).toBe(false)
    expect(cepSchema.safeParse('abcde-123').success).toBe(false)
  })
})
