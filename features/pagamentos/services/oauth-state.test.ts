import { describe, it, expect, beforeAll, vi } from 'vitest'
import { signState, verifyState } from './oauth-state'

beforeAll(() => {
  process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'test-key-only-for-vitest'
})

describe('oauth-state', () => {
  it('assina e verifica de volta o mesmo pousadaId, com um nonce', () => {
    const state = signState('pousada-123')
    const decoded = verifyState(state)
    expect(decoded?.pousadaId).toBe('pousada-123')
    expect(decoded?.nonce).toEqual(expect.any(String))
    expect(decoded?.nonce.length).toBeGreaterThan(0)
  })

  it('gera nonces diferentes a cada chamada (base do uso único)', () => {
    const a = verifyState(signState('pousada-123'))
    const b = verifyState(signState('pousada-123'))
    expect(a?.nonce).not.toBe(b?.nonce)
  })

  it('rejeita state adulterado (assinatura não bate)', () => {
    const state = signState('pousada-123')
    const tampered = state.replace('pousada-123', 'pousada-456')
    expect(verifyState(tampered)).toBeNull()
  })

  it('rejeita state em formato inválido', () => {
    expect(verifyState('nao-e-um-state-valido')).toBeNull()
  })

  it('rejeita state expirado', () => {
    vi.useFakeTimers()
    const state = signState('pousada-123')
    vi.advanceTimersByTime(11 * 60 * 1000) // > 10 min de validade
    expect(verifyState(state)).toBeNull()
    vi.useRealTimers()
  })
})
