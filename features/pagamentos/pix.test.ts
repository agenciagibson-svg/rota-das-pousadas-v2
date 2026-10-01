import { describe, expect, it } from 'vitest'
import {
  displayPixKey,
  isValidCnpj,
  isValidPixKey,
  pixSettingsSchema,
  proofObjectPath,
  reviewProofSchema,
} from './pix'

describe('chave Pix da pousada', () => {
  it('valida cada tipo de chave', () => {
    expect(isValidPixKey('cpf', '529.982.247-25')).toBe(true)
    expect(isValidPixKey('cpf', '111.111.111-11')).toBe(false)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidPixKey('cnpj', '11.222.333/0001-80')).toBe(false)
    expect(isValidPixKey('email', 'financeiro@pousada.com.br')).toBe(true)
    expect(isValidPixKey('email', 'financeiro')).toBe(false)
    expect(isValidPixKey('telefone', '(34) 91234-5678')).toBe(true)
    expect(isValidPixKey('telefone', '(34) 3234-5678')).toBe(false)
    expect(isValidPixKey('aleatoria', '123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isValidPixKey('aleatoria', 'abc')).toBe(false)
  })
  it('formulário aponta a chave inválida', () => {
    const r = pixSettingsSchema.safeParse({
      keyType: 'cnpj',
      pixKey: '123',
      holderName: 'Pousada X',
      city: 'Monte Verde',
      enabled: true,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['pixKey'])
  })
  it('mostra a chave formatada', () => {
    expect(displayPixKey('cnpj', '11222333000181')).toBe('11.222.333/0001-81')
    expect(displayPixKey('telefone', '+5534912345678')).toBe('(34) 91234-5678')
  })
})

describe('comprovante', () => {
  it('caminho começa pelo id da reserva (a regra do Storage confere)', () => {
    const id = '20000000-0000-0000-0000-000000000001'
    expect(proofObjectPath(id, 'Comprovante Itaú.PDF', 'abc')).toBe(`${id}/abc.pdf`)
    expect(proofObjectPath(id, 'foto', 'abc')).toBe(`${id}/abc.foto`)
  })
  it('recusa sem motivo exige texto', () => {
    const base = { proofId: '20000000-0000-0000-0000-000000000001' }
    expect(reviewProofSchema.safeParse({ ...base, approve: true, reason: '' }).success).toBe(true)
    expect(reviewProofSchema.safeParse({ ...base, approve: false, reason: '' }).success).toBe(false)
    expect(
      reviewProofSchema.safeParse({ ...base, approve: false, reason: 'Valor não entrou' }).success,
    ).toBe(true)
  })
})

describe('parseBRL', () => {
  it('aceita formatos brasileiros', async () => {
    const { parseBRL } = await import('./pix')
    expect(parseBRL('1.440,00')).toBe(1440)
    expect(parseBRL('R$ 400,5')).toBe(400.5)
    expect(parseBRL('250')).toBe(250)
    expect(parseBRL('')).toBeNull()
    expect(parseBRL('0')).toBeNull()
    expect(parseBRL('abc')).toBeNull()
  })
})
