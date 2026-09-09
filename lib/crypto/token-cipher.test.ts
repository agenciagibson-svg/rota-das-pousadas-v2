import { describe, it, expect, beforeAll } from 'vitest'
import { encryptToken, decryptToken } from './token-cipher'

beforeAll(() => {
  process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'test-key-only-for-vitest'
})

describe('token-cipher', () => {
  it('cifra e decifra de volta pro valor original', () => {
    const plain = 'APP_USR-1234567890-mercadopago-access-token'
    const encrypted = encryptToken(plain)
    expect(encrypted).not.toBe(plain)
    expect(decryptToken(encrypted)).toBe(plain)
  })

  it('gera ciphertexts diferentes pro mesmo valor (IV aleatório)', () => {
    const plain = 'mesmo-token'
    expect(encryptToken(plain)).not.toBe(encryptToken(plain))
  })

  it('rejeita formato inválido', () => {
    expect(() => decryptToken('valor-sem-separador')).toThrow()
  })

  it('rejeita ciphertext adulterado (auth tag não bate)', () => {
    const encrypted = encryptToken('token-original')
    const [iv, authTag] = encrypted.split(':')
    const tampered = [iv, authTag, Buffer.from('lixo-adulterado').toString('base64')].join(':')
    expect(() => decryptToken(tampered)).toThrow()
  })
})
