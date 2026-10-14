import { describe, it, expect, beforeAll, vi } from 'vitest'
import {
  encryptDocumentNumber,
  decryptDocumentNumber,
  hashDocumentNumberForLookup,
  documentNumberLast4,
  readStoredDocumentNumber,
} from './document-cipher'

beforeAll(() => {
  process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'test-key-only-for-vitest'
})

describe('document-cipher', () => {
  it('cifra e decifra de volta pro valor original', () => {
    const plain = '123.456.789-00'
    const encrypted = encryptDocumentNumber(plain)
    expect(encrypted).not.toBe(plain)
    expect(decryptDocumentNumber(encrypted)).toBe(plain)
  })

  it('gera ciphertexts diferentes pro mesmo valor (IV aleatório)', () => {
    const plain = '123.456.789-00'
    expect(encryptDocumentNumber(plain)).not.toBe(encryptDocumentNumber(plain))
  })

  it('rejeita formato inválido', () => {
    expect(() => decryptDocumentNumber('valor-sem-separador')).toThrow()
  })

  it('rejeita ciphertext adulterado (auth tag não bate)', () => {
    const encrypted = encryptDocumentNumber('123.456.789-00')
    const [iv, authTag] = encrypted.split(':')
    const tampered = [iv, authTag, Buffer.from('lixo-adulterado').toString('base64')].join(':')
    expect(() => decryptDocumentNumber(tampered)).toThrow()
  })

  it('hash é determinístico: mesmo documento sempre gera o mesmo hash', () => {
    const a = hashDocumentNumberForLookup('123.456.789-00')
    const b = hashDocumentNumberForLookup('123.456.789-00')
    expect(a).toBe(b)
  })

  it('hash ignora pontuação e caixa — CPF digitado diferente ainda casa', () => {
    const a = hashDocumentNumberForLookup('123.456.789-00')
    const b = hashDocumentNumberForLookup('12345678900')
    const c = hashDocumentNumberForLookup(' 123 456 789 00 ')
    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('hash de documentos diferentes não bate', () => {
    expect(hashDocumentNumberForLookup('11111111111')).not.toBe(
      hashDocumentNumberForLookup('22222222222'),
    )
  })

  it('hash nunca reproduz o valor original nem o ciphertext', () => {
    const plain = '123.456.789-00'
    const hash = hashDocumentNumberForLookup(plain)
    expect(hash).not.toContain(plain)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('last4 pega os últimos 4 caracteres já normalizados', () => {
    expect(documentNumberLast4('123.456.789-00')).toBe('8900')
  })

  it('last4 de documento com menos de 4 caracteres retorna o que houver', () => {
    expect(documentNumberLast4('AB')).toBe('AB')
  })

  it('readStoredDocumentNumber decifra o que foi gravado cifrado', () => {
    expect(readStoredDocumentNumber(encryptDocumentNumber('AB123456'))).toBe('AB123456')
  })

  it('readStoredDocumentNumber devolve como está o valor antigo, em texto puro', () => {
    expect(readStoredDocumentNumber('123.456.789-00')).toBe('123.456.789-00')
    expect(readStoredDocumentNumber('MG-12.345.678')).toBe('MG-12.345.678')
    expect(readStoredDocumentNumber(null)).toBeNull()
    expect(readStoredDocumentNumber('')).toBeNull()
  })

  it('readStoredDocumentNumber não devolve o texto cifrado quando ele não decifra', () => {
    const tampered = encryptDocumentNumber('123.456.789-00').replace(/.$/, (c) =>
      c === 'A' ? 'B' : 'A',
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = readStoredDocumentNumber(tampered)
    error.mockRestore()
    expect(result === null || result === '123.456.789-00').toBe(true)
    expect(result).not.toBe(tampered)
  })

  it('usa a chave nova quando o segredo muda (cache por segredo)', () => {
    const encrypted = encryptDocumentNumber('999')
    process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'outra-chave'
    expect(() => decryptDocumentNumber(encrypted)).toThrow()
    process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'test-key-only-for-vitest'
    expect(decryptDocumentNumber(encrypted)).toBe('999')
  })
})
