import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({
  syncAllFeeds: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/features/canais/services/sync.service', () => ({ syncAllFeeds: mocks.syncAllFeeds }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const SECRET = 'segredo-do-cron-de-teste'

function request(authorization?: string) {
  return new Request('http://localhost/api/cron/canais', {
    headers: authorization === undefined ? {} : { authorization },
  })
}

async function silenced<T>(run: () => Promise<T>): Promise<T> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return await run()
  } finally {
    log.mockRestore()
  }
}

describe('cron de canais (importação dos calendários das OTAs)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('CRON_SECRET', SECRET)
    mocks.syncAllFeeds.mockResolvedValue({ feeds: 3, ok: 3, failed: 0 })
    mocks.reportError.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('autorização', () => {
    it('sem CRON_SECRET configurado ninguém dispara a rodada, nem com "Bearer " vazio', async () => {
      vi.stubEnv('CRON_SECRET', '')

      for (const header of [undefined, 'Bearer ', 'Bearer undefined', `Bearer ${SECRET}`]) {
        expect((await GET(request(header))).status).toBe(401)
      }
      expect(mocks.syncAllFeeds).not.toHaveBeenCalled()
    })

    it.each([
      ['sem cabeçalho', undefined],
      ['segredo errado', 'Bearer segredo-errado-de-teste!!'],
      ['segredo certo sem o prefixo Bearer', SECRET],
      ['segredo certo com sobra no final', `Bearer ${SECRET}x`],
    ])('%s → 401 e nenhuma OTA é consultada', async (_label, header) => {
      const response = await GET(request(header))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Não autorizado.' })
      expect(mocks.syncAllFeeds).not.toHaveBeenCalled()
    })
  })

  it('com o segredo certo roda a importação e devolve o relatório', async () => {
    const response = await GET(request(`Bearer ${SECRET}`))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ feeds: 3, ok: 3, failed: 0 })
    expect(mocks.syncAllFeeds).toHaveBeenCalledTimes(1)
  })

  it('canal de um cliente em falha não quebra o cron: a rodada responde 200 com o relatório', async () => {
    mocks.syncAllFeeds.mockResolvedValue({ feeds: 3, ok: 2, failed: 1 })

    const response = await GET(request(`Bearer ${SECRET}`))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ feeds: 3, ok: 2, failed: 1 })
  })

  it('erro na rodada: 500 com mensagem genérica, sem o detalhe técnico', async () => {
    mocks.syncAllFeeds.mockRejectedValue(
      new Error('permission denied for function list_channel_feeds_to_import'),
    )

    const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(response.status).toBe(500)
    const raw = await response.text()
    expect(JSON.parse(raw)).toEqual({ error: 'Falha inesperada.' })
    expect(raw).not.toContain('permission denied')
  })

  it('erro na rodada vai para o monitoramento', async () => {
    const failure = new Error('banco indisponível')
    mocks.syncAllFeeds.mockRejectedValue(failure)

    await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(mocks.reportError).toHaveBeenCalledWith(failure, { where: 'cron:canais' })
  })

  it('erro que não é um Error (valor qualquer lançado) também vira 500 genérico', async () => {
    mocks.syncAllFeeds.mockRejectedValue('timeout na OTA')

    const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Falha inesperada.' })
  })
})
