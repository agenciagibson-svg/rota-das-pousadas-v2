import { describe, expect, it, vi } from 'vitest'
import { pousadas } from '@/lib/data'
import { conciergeRequestSchema, createRateLimiter, respondConcierge } from './respond'

const TODAY = '2026-10-13'
const messages = [{ role: 'user' as const, content: 'cabana na floresta' }]

describe('respondConcierge', () => {
  it('sem chave: responde no modo local', async () => {
    const r = await respondConcierge({ messages, pousadas, today: TODAY })
    expect(r.engine).toBe('local')
    expect(r.cards.length).toBeGreaterThan(0)
  })

  it('OpenAI falhando: cai no modo local sem quebrar a conversa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(
      async () => new Response('erro', { status: 500 }),
    ) as unknown as typeof fetch
    const r = await respondConcierge({
      messages,
      pousadas,
      today: TODAY,
      apiKey: 'sk-teste-sintetico',
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalled()
    expect(r.engine).toBe('local')
    warn.mockRestore()
  })
})

describe('conciergeRequestSchema', () => {
  it('recusa conversa que não termina no hóspede ou é longa demais', () => {
    expect(conciergeRequestSchema.safeParse({ messages }).success).toBe(true)
    expect(
      conciergeRequestSchema.safeParse({ messages: [{ role: 'assistant', content: 'oi' }] })
        .success,
    ).toBe(false)
    expect(
      conciergeRequestSchema.safeParse({ messages: [{ role: 'user', content: 'x'.repeat(801) }] })
        .success,
    ).toBe(false)
  })
})

describe('createRateLimiter', () => {
  it('bloqueia acima do limite e libera quando a janela passa', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 })
    expect(allow('ip', 0)).toBe(true)
    expect(allow('ip', 10)).toBe(true)
    expect(allow('ip', 20)).toBe(false)
    expect(allow('outro', 20)).toBe(true)
    expect(allow('ip', 1015)).toBe(true)
  })
})
