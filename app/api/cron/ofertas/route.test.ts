import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendDueOfferEmails: vi.fn(),
  runAutoOffers: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/features/ofertas/services/offers.service', () => ({
  sendDueOfferEmails: mocks.sendDueOfferEmails,
  runAutoOffers: mocks.runAutoOffers,
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

import { GET } from './route'

const SECRET = 'segredo-de-teste-ofertas'
const req = (auth?: string) =>
  new Request('http://localhost/api/cron/ofertas', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET)
  mocks.runAutoOffers.mockResolvedValue({ offers: 1, people: 4 })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('rodada das ofertas', () => {
  it('sem o segredo: 401 e nada roda', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer errado'))).status).toBe(401)
    expect(mocks.sendDueOfferEmails).not.toHaveBeenCalled()
    expect(mocks.runAutoOffers).not.toHaveBeenCalled()
  })

  it('com o segredo: cria as automáticas e depois manda os e-mails da fila', async () => {
    const order: string[] = []
    mocks.runAutoOffers.mockImplementation(async () => {
      order.push('auto')
      return { offers: 1, people: 4 }
    })
    mocks.sendDueOfferEmails.mockImplementation(async () => {
      order.push('emails')
      return { sent: 3, failed: 0 }
    })
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      auto: { offers: 1, people: 4 },
      emails: { sent: 3, failed: 0 },
    })
    expect(order).toEqual(['auto', 'emails'])
  })

  it('automáticas falhando: a fila de e-mails sai mesmo assim', async () => {
    mocks.runAutoOffers.mockRejectedValue(new Error('x'))
    mocks.sendDueOfferEmails.mockResolvedValue({ sent: 1, failed: 0 })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req(`Bearer ${SECRET}`))
    log.mockRestore()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ auto: { error: 'falhou' }, emails: { sent: 1, failed: 0 } })
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
      where: 'cron:ofertas-automaticas',
    })
  })

  it('falha: 500 genérico e monitoramento', async () => {
    mocks.sendDueOfferEmails.mockRejectedValue(new Error('relation x does not exist'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req(`Bearer ${SECRET}`))
    log.mockRestore()
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('relation')
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), { where: 'cron:ofertas' })
  })
})
