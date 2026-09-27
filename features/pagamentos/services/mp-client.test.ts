import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildPayer,
  createCheckoutPreference,
  getPaymentById,
  mapAuthorizedPaymentStatus,
  searchPaymentsByExternalReference,
} from './mp-client'
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

describe('busca de pagamentos por reserva (reconciliação)', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('filtra pela referência e ignora itens fora do formato', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: [payment, { id: 'lixo' }] })))
    vi.stubGlobal('fetch', fetch)
    const found = await searchPaymentsByExternalReference(payment.external_reference, 'test-token')
    expect(found).toHaveLength(1)
    expect(found[0]?.id).toBe(123)
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('external_reference=' + payment.external_reference)
  })
  it('recusa referência que não é UUID antes da requisição', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(searchPaymentsByExternalReference('../x', 'test-token')).rejects.toThrow()
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

describe('preferência do Checkout Pro (0070)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const base = {
    sellerAccessToken: 'seller-token',
    title: 'Reserva RP-TEST',
    quantity: 1,
    unitPrice: 1000,
    externalReference: 'booking',
    notificationUrl: 'https://example.test/webhook',
    backUrls: {
      success: 'https://example.test',
      pending: 'https://example.test',
      failure: 'https://example.test',
    },
  }
  const sentBody = (fetch: ReturnType<typeof vi.fn>) =>
    JSON.parse(fetch.mock.calls[0][1].body as string)
  it('aceita só Pix e cartão e expira no prazo da reserva', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'p', init_point: 'x', sandbox_init_point: 'y' })),
      )
    vi.stubGlobal('fetch', fetch)
    await createCheckoutPreference({ ...base, expiresAt: '2026-09-27T20:00:00.000Z' })
    const body = sentBody(fetch)
    expect(body.payment_methods.excluded_payment_types).toEqual([{ id: 'ticket' }, { id: 'atm' }])
    expect(body.expires).toBe(true)
    expect(body.expiration_date_to).toBe('2026-09-27T20:00:00.000Z')
  })
  it('sem prazo, o link não expira', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'p', init_point: 'x', sandbox_init_point: 'y' })),
      )
    vi.stubGlobal('fetch', fetch)
    await createCheckoutPreference(base)
    const body = sentBody(fetch)
    expect(body).not.toHaveProperty('expires')
    expect(body).not.toHaveProperty('expiration_date_to')
  })
})

describe('buildPayer (e-mail do hóspede no checkout)', () => {
  it('preenche e-mail, nome e sobrenome', () => {
    expect(buildPayer({ email: ' ana@ex.com ', name: 'Ana Maria Souza' })).toEqual({
      email: 'ana@ex.com',
      name: 'Ana',
      surname: 'Maria Souza',
    })
  })
  it('omite quando o e-mail é inválido ou vazio', () => {
    expect(buildPayer({ email: 'nao-e-email', name: 'Ana' })).toBeUndefined()
    expect(buildPayer({ email: null })).toBeUndefined()
    expect(buildPayer(undefined)).toBeUndefined()
  })
})
