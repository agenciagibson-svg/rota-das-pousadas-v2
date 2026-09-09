import { describe, it, expect, beforeAll, vi } from 'vitest'
import { signState, verifyState } from './oauth-state'

beforeAll(() => {
  process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'test-key-only-for-vitest'
})

describe('oauth-state', () => {
  it('assina e verifica de volta o mesmo pousadaId', () => {
    const state = signState('pousada-123')
    expect(verifyState(state)).toEqual({ pousadaId: 'pousada-123' })
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
