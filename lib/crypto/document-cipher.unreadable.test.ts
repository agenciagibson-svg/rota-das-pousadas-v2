import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptDocumentNumber, isUnreadableStoredDocument } from './document-cipher'

const ORIGINAL_KEY = process.env.PAYMENT_TOKENS_ENCRYPTION_KEY

function useKey(key: string) {
  process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = key
}

beforeEach(() => {
  useKey('chave-a')
})

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.PAYMENT_TOKENS_ENCRYPTION_KEY
  else process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = ORIGINAL_KEY
})

describe('isUnreadableStoredDocument (documento salvo que este ambiente não decifra)', () => {
  it('sem documento salvo (nulo ou vazio) não há nada ilegível', () => {
    expect(isUnreadableStoredDocument(null)).toBe(false)
    expect(isUnreadableStoredDocument('')).toBe(false)
  })

  it.each(['123.456.789-00', '12345678900', 'MG-12.345.678', 'AB123456'])(
    'documento antigo em texto puro (%s) é legível',
    (plain) => {
      expect(isUnreadableStoredDocument(plain)).toBe(false)
    },
  )

  it('texto puro com dois-pontos, mas fora do formato cifrado, é legível', () => {
    expect(isUnreadableStoredDocument('RG: 12.345.678')).toBe(false)
    expect(isUnreadableStoredDocument('a:b:c')).toBe(false)
  })

  it('documento cifrado com a chave atual é legível', () => {
    const stored = encryptDocumentNumber('123.456.789-00')

    expect(isUnreadableStoredDocument(stored)).toBe(false)
  })

  it('documento cifrado com OUTRA chave é ilegível', () => {
    const stored = encryptDocumentNumber('123.456.789-00')

    useKey('chave-b')

    expect(isUnreadableStoredDocument(stored)).toBe(true)
  })

  it('volta a ser legível quando a chave original é restaurada', () => {
    const stored = encryptDocumentNumber('123.456.789-00')

    useKey('chave-b')
    expect(isUnreadableStoredDocument(stored)).toBe(true)

    useKey('chave-a')
    expect(isUnreadableStoredDocument(stored)).toBe(false)
  })

  it('documento cifrado e depois adulterado é ilegível', () => {
    const [iv, authTag] = encryptDocumentNumber('123.456.789-00').split(':')
    const tampered = [iv, authTag, Buffer.from('lixo-adulterado').toString('base64')].join(':')

    expect(isUnreadableStoredDocument(tampered)).toBe(true)
  })

  it('sem chave configurada, documento cifrado é ilegível — e texto puro continua legível', () => {
    const stored = encryptDocumentNumber('123.456.789-00')

    delete process.env.PAYMENT_TOKENS_ENCRYPTION_KEY

    expect(isUnreadableStoredDocument(stored)).toBe(true)
    expect(isUnreadableStoredDocument('123.456.789-00')).toBe(false)
  })

  it('nunca lança nem escreve no log de erro ao encontrar documento ilegível', () => {
    const stored = encryptDocumentNumber('123.456.789-00')
    useKey('chave-b')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(() => isUnreadableStoredDocument(stored)).not.toThrow()
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
})
