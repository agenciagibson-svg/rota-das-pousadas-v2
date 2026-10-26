import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listMonthlyReportPousadasRpc: vi.fn(),
  getMonthlyReportPousadaRpc: vi.fn(),
  listMonthlyReportBookingsRpc: vi.fn(),
  listMonthlyReportRecipientsRpc: vi.fn(),
  claimMonthlyReportRpc: vi.fn(),
  markMonthlyReportSentRpc: vi.fn(),
  releaseMonthlyReportRpc: vi.fn(),
  sendEmail: vi.fn(),
  sendEmailWithResult: vi.fn(),
}))
vi.mock('@/repositories/monthly-report.repository', () => ({
  listMonthlyReportPousadasRpc: mocks.listMonthlyReportPousadasRpc,
  getMonthlyReportPousadaRpc: mocks.getMonthlyReportPousadaRpc,
  listMonthlyReportBookingsRpc: mocks.listMonthlyReportBookingsRpc,
  listMonthlyReportRecipientsRpc: mocks.listMonthlyReportRecipientsRpc,
  claimMonthlyReportRpc: mocks.claimMonthlyReportRpc,
  markMonthlyReportSentRpc: mocks.markMonthlyReportSentRpc,
  releaseMonthlyReportRpc: mocks.releaseMonthlyReportRpc,
}))
vi.mock('@/lib/email/mailer', () => ({
  sendEmail: mocks.sendEmail,
  sendEmailWithResult: mocks.sendEmailWithResult,
}))
vi.mock('@/lib/env', () => ({ publicEnv: { siteUrl: 'https://rotadaspousadas.com.br' } }))

import {
  MONTHLY_REPORTS_PER_RUN,
  sendMonthlyReportPreview,
  sendMonthlyReports,
} from './monthly-report.service'

// 1º de outubro de 2026, 04:00 em Brasília (07:00 UTC, horário do cron).
const DAY_1 = new Date('2026-10-01T07:00:00Z')

const pousada = (n: number) => ({
  pousadaId: `10000000-0000-0000-0000-00000000970${n}`,
  name: `Pousada ${n}`,
  timezone: 'America/Sao_Paulo',
  activeRooms: 2,
})

const sept = [
  {
    checkin: '2026-09-10',
    checkout: '2026-09-12',
    total: 600,
    status: 'checked_out',
    origin: 'airbnb',
  },
]

async function silenced<T>(run: () => Promise<T>): Promise<T> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return await run()
  } finally {
    log.mockRestore()
  }
}

describe('relatório do mês no cron diário', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.listMonthlyReportBookingsRpc.mockResolvedValue(sept)
    mocks.listMonthlyReportRecipientsRpc.mockResolvedValue([
      'dono@example.test',
      'gestor@example.test',
    ])
    mocks.claimMonthlyReportRpc.mockResolvedValue(true)
    mocks.markMonthlyReportSentRpc.mockResolvedValue(undefined)
    mocks.releaseMonthlyReportRpc.mockResolvedValue(undefined)
    mocks.sendEmail.mockResolvedValue(true)
  })

  it.each([
    ['dia 4', '2026-10-04T12:00:00Z'],
    ['dia 15', '2026-10-15T12:00:00Z'],
    // 30/09 às 22h em Brasília já é 1º/10 em UTC: ainda não é dia 1 no Brasil.
    ['30/09 à noite (já 1º em UTC)', '2026-10-01T01:00:00Z'],
  ])('fora dos dias 1–3 em Brasília não faz nada (%s)', async (_label, iso) => {
    expect(await sendMonthlyReports(new Date(iso))).toEqual({ skipped: true })
    expect(mocks.listMonthlyReportPousadasRpc).not.toHaveBeenCalled()
  })

  it('dia 1: manda o resumo de setembro ao dono e ao gestor e marca enviado', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([pousada(1)])

    expect(await sendMonthlyReports(DAY_1)).toEqual({
      skipped: false,
      month: '2026-09-01',
      sent: 1,
      failed: 0,
      noRecipients: 0,
    })
    expect(mocks.listMonthlyReportPousadasRpc).toHaveBeenCalledWith(
      '2026-09-01',
      MONTHLY_REPORTS_PER_RUN,
    )
    // Reservas de agosto e setembro (comparação com o mês anterior).
    expect(mocks.listMonthlyReportBookingsRpc).toHaveBeenCalledWith(
      pousada(1).pousadaId,
      '2026-08-01',
      '2026-10-01',
    )
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dono@example.test',
        subject: 'Resumo de setembro de 2026 — Pousada 1',
      }),
    )
    expect(mocks.markMonthlyReportSentRpc).toHaveBeenCalledWith(
      pousada(1).pousadaId,
      '2026-09-01',
      2,
    )
    expect(mocks.releaseMonthlyReportRpc).not.toHaveBeenCalled()
  })

  it('reserva a vez ANTES de enviar: outra rodada com a vez não manda de novo', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([pousada(1), pousada(2)])
    mocks.claimMonthlyReportRpc.mockImplementation(
      async (id: string) => id === pousada(2).pousadaId,
    )

    const result = await sendMonthlyReports(DAY_1)

    expect(result).toMatchObject({ sent: 1, failed: 0 })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2) // só os 2 destinatários da pousada 2
    expect(mocks.listMonthlyReportBookingsRpc).toHaveBeenCalledTimes(1)
  })

  it('nenhum e-mail saiu: não marca, devolve a vez e a pousada volta no dia seguinte', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([pousada(1)])
    mocks.sendEmail.mockResolvedValue(false)

    expect(await sendMonthlyReports(DAY_1)).toMatchObject({ sent: 0, failed: 1 })
    expect(mocks.markMonthlyReportSentRpc).not.toHaveBeenCalled()
    expect(mocks.releaseMonthlyReportRpc).toHaveBeenCalledWith(pousada(1).pousadaId, '2026-09-01')
  })

  it('um destinatário recebeu: marca enviado com 1 (quem recebeu não recebe de novo)', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([pousada(1)])
    mocks.sendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    expect(await sendMonthlyReports(DAY_1)).toMatchObject({ sent: 1, failed: 0 })
    expect(mocks.markMonthlyReportSentRpc).toHaveBeenCalledWith(
      pousada(1).pousadaId,
      '2026-09-01',
      1,
    )
  })

  it('erro numa pousada não derruba as outras e devolve a vez dela', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([pousada(1), pousada(2)])
    mocks.listMonthlyReportBookingsRpc
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(sept)

    const result = await silenced(() => sendMonthlyReports(DAY_1))

    expect(result).toMatchObject({ sent: 1, failed: 1 })
    expect(mocks.releaseMonthlyReportRpc).toHaveBeenCalledWith(pousada(1).pousadaId, '2026-09-01')
    expect(mocks.markMonthlyReportSentRpc).toHaveBeenCalledWith(
      pousada(2).pousadaId,
      '2026-09-01',
      2,
    )
  })

  it('pousada sem proprietário/gestor ativo: não envia e não marca', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([pousada(1)])
    mocks.listMonthlyReportRecipientsRpc.mockResolvedValue([])

    expect(await sendMonthlyReports(DAY_1)).toMatchObject({ sent: 0, failed: 0, noRecipients: 1 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.markMonthlyReportSentRpc).not.toHaveBeenCalled()
  })

  it('dias 2 e 3 tentam de novo o mesmo mês', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([])
    await sendMonthlyReports(new Date('2026-10-03T07:00:00Z'))
    expect(mocks.listMonthlyReportPousadasRpc).toHaveBeenCalledWith(
      '2026-09-01',
      MONTHLY_REPORTS_PER_RUN,
    )
  })

  it('virada do ano: em 1º de janeiro o relatório é de dezembro', async () => {
    mocks.listMonthlyReportPousadasRpc.mockResolvedValue([])
    expect(await sendMonthlyReports(new Date('2027-01-01T07:00:00Z'))).toMatchObject({
      month: '2026-12-01',
    })
  })
})

describe('prévia do relatório (admin)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.listMonthlyReportBookingsRpc.mockResolvedValue(sept)
    mocks.sendEmailWithResult.mockResolvedValue({
      status: 'enviado',
      from: 'reservas@x.test',
      host: 'smtp.x.test',
    })
  })

  it('manda só para quem pediu, marcado como prévia, sem reservar a vez nem marcar enviado', async () => {
    mocks.getMonthlyReportPousadaRpc.mockResolvedValue(pousada(3))

    const result = await sendMonthlyReportPreview(
      pousada(3).pousadaId,
      'master@example.test',
      new Date('2026-10-26T15:00:00Z'),
    )

    expect(result).toMatchObject({
      status: 'enviado',
      to: 'master@example.test',
      month: '2026-09-01',
      monthLabel: 'setembro de 2026',
    })
    expect(mocks.sendEmailWithResult).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'master@example.test',
        subject: '[Prévia] Resumo de setembro de 2026 — Pousada 3',
      }),
    )
    expect(mocks.claimMonthlyReportRpc).not.toHaveBeenCalled()
    expect(mocks.markMonthlyReportSentRpc).not.toHaveBeenCalled()
    expect(mocks.listMonthlyReportRecipientsRpc).not.toHaveBeenCalled()
  })

  it('pousada inexistente: erro claro', async () => {
    mocks.getMonthlyReportPousadaRpc.mockResolvedValue(null)
    await expect(
      sendMonthlyReportPreview('10000000-0000-0000-0000-000000000000', 'm@example.test'),
    ).rejects.toThrow('Pousada não encontrada.')
  })
})
