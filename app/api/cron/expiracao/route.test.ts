import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({
  expireOverduePendingBookings: vi.fn(),
  purgeStaleQuoteRequests: vi.fn(),
  sendCheckinReminders: vi.fn(),
  notifyPaymentReviews: vi.fn(),
  sendReviewRequests: vi.fn(),
  sendReviewReminders: vi.fn(),
  sendMonthlyReports: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/features/dashboard/services/monthly-report.service', () => ({
  sendMonthlyReports: mocks.sendMonthlyReports,
}))
vi.mock('@/features/estadia/services/review-requests.service', () => ({
  sendReviewRequests: mocks.sendReviewRequests,
  sendReviewReminders: mocks.sendReviewReminders,
}))
vi.mock('@/features/reservas/services/expire-overdue.service', () => ({
  expireOverduePendingBookings: mocks.expireOverduePendingBookings,
}))
vi.mock('@/features/bio/services/bio.service', () => ({
  purgeStaleQuoteRequests: mocks.purgeStaleQuoteRequests,
}))
vi.mock('@/features/reservas/services/checkin-reminders.service', () => ({
  sendCheckinReminders: mocks.sendCheckinReminders,
}))
vi.mock('@/features/pagamentos/services/pix.service', () => ({
  notifyPaymentReviews: mocks.notifyPaymentReviews,
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const SECRET = 'segredo-do-cron-de-teste'
const TECHNICAL = 'relation "bookings" does not exist (host db.interno:5432)'

function request(authorization?: string) {
  return new Request('http://localhost/api/cron/expiracao', {
    headers: authorization === undefined ? {} : { authorization },
  })
}

function expectNothingRan() {
  expect(mocks.expireOverduePendingBookings).not.toHaveBeenCalled()
  expect(mocks.purgeStaleQuoteRequests).not.toHaveBeenCalled()
  expect(mocks.sendCheckinReminders).not.toHaveBeenCalled()
  expect(mocks.notifyPaymentReviews).not.toHaveBeenCalled()
  expect(mocks.sendReviewRequests).not.toHaveBeenCalled()
  expect(mocks.sendReviewReminders).not.toHaveBeenCalled()
  expect(mocks.sendMonthlyReports).not.toHaveBeenCalled()
}

async function silenced<T>(run: () => Promise<T>): Promise<T> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return await run()
  } finally {
    log.mockRestore()
  }
}

describe('cron de expiração (rodada diária de manutenção)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('CRON_SECRET', SECRET)
    mocks.expireOverduePendingBookings.mockResolvedValue({ expired: 2 })
    mocks.purgeStaleQuoteRequests.mockResolvedValue({ purged: 1 })
    mocks.sendCheckinReminders.mockResolvedValue({ sent: 3 })
    mocks.notifyPaymentReviews.mockResolvedValue({ notified: 1 })
    mocks.sendReviewRequests.mockResolvedValue({ sent: 4, failed: 0 })
    mocks.sendReviewReminders.mockResolvedValue({ sent: 1, failed: 1 })
    mocks.sendMonthlyReports.mockResolvedValue({ skipped: true })
    mocks.reportError.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('autorização', () => {
    it('sem CRON_SECRET configurado ninguém roda o cron, nem com "Bearer " vazio', async () => {
      vi.stubEnv('CRON_SECRET', '')

      for (const header of [undefined, 'Bearer ', 'Bearer undefined', `Bearer ${SECRET}`]) {
        expect((await GET(request(header))).status).toBe(401)
      }
      expectNothingRan()
    })

    it.each([
      ['sem cabeçalho', undefined],
      ['segredo errado', 'Bearer segredo-errado-de-teste!!'],
      ['segredo certo sem o prefixo Bearer', SECRET],
      ['segredo certo com sobra no final', `Bearer ${SECRET}x`],
      ['só o começo do segredo', `Bearer ${SECRET.slice(0, 8)}`],
    ])('%s → 401 e nada roda', async (_label, header) => {
      const response = await GET(request(header))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Não autorizado.' })
      expectNothingRan()
    })
  })

  it('com o segredo certo roda todas as tarefas e devolve o resumo de cada uma', async () => {
    const response = await GET(request(`Bearer ${SECRET}`))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      bookings: { expired: 2 },
      quoteRequests: { purged: 1 },
      checkinReminders: { sent: 3 },
      reviewRequests: { sent: 4, failed: 0 },
      reviewReminders: { sent: 1, failed: 1 },
      monthlyReports: { skipped: true },
      paymentReviews: { notified: 1 },
    })
  })

  it('o pedido de avaliação falhando não derruba as outras tarefas e vai para o monitoramento', async () => {
    mocks.sendReviewRequests.mockRejectedValue(new Error(TECHNICAL))

    const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(response.status).toBe(500)
    expect(mocks.sendReviewReminders).toHaveBeenCalledTimes(1)
    expect(mocks.sendCheckinReminders).toHaveBeenCalledTimes(1)
    expect(await response.json()).toMatchObject({
      bookings: { expired: 2 },
      reviewRequests: { error: 'falhou' },
      reviewReminders: { sent: 1, failed: 1 },
    })
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), { where: 'cron:avaliacoes' })
  })

  it('o relatório do mês falhando não derruba as outras tarefas e vai para o monitoramento', async () => {
    mocks.sendMonthlyReports.mockRejectedValue(new Error(TECHNICAL))

    const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(response.status).toBe(500)
    expect(mocks.sendReviewRequests).toHaveBeenCalledTimes(1)
    expect(await response.json()).toMatchObject({
      bookings: { expired: 2 },
      monthlyReports: { error: 'falhou' },
    })
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
      where: 'cron:relatorio-mensal',
    })
  })

  it('avisa sobre pagamentos para revisar só depois de expirar as reservas vencidas', async () => {
    const order: string[] = []
    mocks.expireOverduePendingBookings.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push('expiracao')
      return { expired: 1 }
    })
    mocks.notifyPaymentReviews.mockImplementation(async () => {
      order.push('avisos')
      return { notified: 1 }
    })

    await GET(request(`Bearer ${SECRET}`))

    expect(order).toEqual(['expiracao', 'avisos'])
  })

  describe('uma tarefa falhando', () => {
    beforeEach(() => {
      mocks.purgeStaleQuoteRequests.mockRejectedValue(new Error(TECHNICAL))
    })

    it('responde 500 para a Vercel marcar a rodada como quebrada', async () => {
      const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

      expect(response.status).toBe(500)
    })

    it('as outras tarefas ainda rodam e aparecem no resumo', async () => {
      const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

      expect(mocks.expireOverduePendingBookings).toHaveBeenCalledTimes(1)
      expect(mocks.sendCheckinReminders).toHaveBeenCalledTimes(1)
      expect(mocks.notifyPaymentReviews).toHaveBeenCalledTimes(1)
      expect(mocks.sendReviewRequests).toHaveBeenCalledTimes(1)
      expect(mocks.sendReviewReminders).toHaveBeenCalledTimes(1)
      expect(await response.json()).toEqual({
        bookings: { expired: 2 },
        quoteRequests: { error: 'falhou' },
        checkinReminders: { sent: 3 },
        reviewRequests: { sent: 4, failed: 0 },
        reviewReminders: { sent: 1, failed: 1 },
        monthlyReports: { skipped: true },
        paymentReviews: { notified: 1 },
      })
    })

    it('a resposta não contém a mensagem técnica do erro', async () => {
      const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

      const raw = await response.text()
      expect(raw).not.toContain('relation')
      expect(raw).not.toContain('db.interno')
    })

    it('o erro vai para o monitoramento identificando a tarefa que falhou', async () => {
      await silenced(() => GET(request(`Bearer ${SECRET}`)))

      expect(mocks.reportError).toHaveBeenCalledTimes(1)
      expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
        where: 'cron:orcamentos',
      })
    })
  })

  it('todas as tarefas falhando: 500, cada falha reportada e nenhuma mensagem técnica na resposta', async () => {
    mocks.expireOverduePendingBookings.mockRejectedValue(new Error(TECHNICAL))
    mocks.purgeStaleQuoteRequests.mockRejectedValue(new Error(TECHNICAL))
    mocks.sendCheckinReminders.mockRejectedValue(new Error(TECHNICAL))

    const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(response.status).toBe(500)
    expect(mocks.reportError).toHaveBeenCalledTimes(3)
    expect(await response.text()).not.toContain('relation')
  })

  it('falha inesperada fora das tarefas: 500 com mensagem genérica', async () => {
    mocks.notifyPaymentReviews.mockRejectedValue(new Error(TECHNICAL))

    const response = await silenced(() => GET(request(`Bearer ${SECRET}`)))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Falha inesperada.' })
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), { where: 'cron:expiracao' })
  })
})
