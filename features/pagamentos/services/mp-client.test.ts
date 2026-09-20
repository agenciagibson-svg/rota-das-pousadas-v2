import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPaymentById, mapAuthorizedPaymentStatus } from './mp-client'
const payment = {
  id: 123,
  status: 'approved',
  transaction_amount: 600.5,
  transaction_amount_refunded: 0,
  currency_id: 'BRL',
  date_last_updated: '2026-09-11T12:00:00Z',
  payment_method_id: 'pix',
  external_reference: '30000000-0000-0000-0000-000000000001',
}
describe('consulta de pagamento', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('valida resposta e mantém centavos com timeout e sem cache', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payment)))
    vi.stubGlobal('fetch', fetch)
    expect((await getPaymentById('123', 'test-token')).transaction_amount).toBe(600.5)
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })
  it('recusa moeda diferente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...payment, currency_id: 'USD' }))),
    )
    await expect(getPaymentById('123', 'test-token')).rejects.toThrow()
  })
  it('recusa ID inválido antes da requisição', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(getPaymentById('../other', 'test-token')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('mapAuthorizedPaymentStatus (fatura de assinatura)', () => {
  it('mapeia os status conhecidos e cai em pending pro resto', () => {
    expect(mapAuthorizedPaymentStatus('processed')).toBe('approved')
    expect(mapAuthorizedPaymentStatus('rejected')).toBe('rejected')
    expect(mapAuthorizedPaymentStatus('cancelled')).toBe('cancelled')
    expect(mapAuthorizedPaymentStatus('refunded')).toBe('refunded')
    expect(mapAuthorizedPaymentStatus('scheduled')).toBe('pending')
  })
})
