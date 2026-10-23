import { describe, expect, it } from 'vitest'
import { applyHeaderFetch } from './use-header-summary'
import type { HeaderSummary } from '@/features/auth/header-summary'

const logged = { user: { firstName: 'Ana' } } as unknown as HeaderSummary

describe('applyHeaderFetch', () => {
  it('resposta boa substitui o que havia', () => {
    expect(applyHeaderFetch(logged, { ok: true, data: { user: null } })).toEqual({ user: null })
    expect(applyHeaderFetch(null, { ok: true, data: logged })).toBe(logged)
  })

  it('falha passageira não apaga quem já estava logado', () => {
    expect(applyHeaderFetch(logged, { ok: false })).toBe(logged)
  })

  it('falha sem nada guardado vira visitante', () => {
    expect(applyHeaderFetch(null, { ok: false })).toEqual({ user: null })
  })
})
