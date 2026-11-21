import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendDueOfferEmails: vi.fn(), reportError: vi.fn() }))
vi.mock('@/features/ofertas/services/offers.service', () => ({
  sendDueOfferEmails: mocks.sendDueOfferEmails,
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

import { GET } from './route'

const SECRET = 'segredo-de-teste-ofertas'
const req = (auth?: string) =>
  new Request('http://localhost/api/cron/ofertas', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => vi.stubEnv('CRON_SECRET', SECRET))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('rodada das ofertas', () => {
  it('sem o segredo: 401 e nada roda', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer errado'))).status).toBe(401)
    expect(mocks.sendDueOfferEmails).not.toHaveBeenCalled()
  })

  it('com o segredo: manda os e-mails da fila', async () => {
    mocks.sendDueOfferEmails.mockResolvedValue({ sent: 3, failed: 0 })
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ emails: { sent: 3, failed: 0 } })
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
