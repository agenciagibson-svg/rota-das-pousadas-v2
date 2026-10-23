import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listReviewRequestsDueRpc: vi.fn(),
  listReviewRemindersDueRpc: vi.fn(),
  markReviewRequestSentRpc: vi.fn(),
  markReviewReminderSentRpc: vi.fn(),
  sendEmail: vi.fn(),
}))
vi.mock('@/repositories/reviews.repository', () => ({
  listReviewRequestsDueRpc: mocks.listReviewRequestsDueRpc,
  listReviewRemindersDueRpc: mocks.listReviewRemindersDueRpc,
  markReviewRequestSentRpc: mocks.markReviewRequestSentRpc,
  markReviewReminderSentRpc: mocks.markReviewReminderSentRpc,
}))
vi.mock('@/lib/email/mailer', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/env', () => ({ publicEnv: { siteUrl: 'https://rotadaspousadas.com.br' } }))

import {
  REVIEW_EMAILS_PER_RUN,
  sendReviewReminders,
  sendReviewRequests,
} from './review-requests.service'

const target = (n: number) => ({
  bookingId: `30000000-0000-0000-0000-00000000890${n}`,
  code: `RP-${n}`,
  guestName: 'Ana Viajante',
  guestEmail: `hospede${n}@example.test`,
  pousadaName: 'Pousada Sol',
})

async function silenced<T>(run: () => Promise<T>): Promise<T> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return await run()
  } finally {
    log.mockRestore()
  }
}

describe('pedido de avaliação no cron', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.markReviewRequestSentRpc.mockResolvedValue(undefined)
    mocks.markReviewReminderSentRpc.mockResolvedValue(undefined)
  })

  it('envia e marca cada reserva depois do envio, com limite por rodada', async () => {
    mocks.listReviewRequestsDueRpc.mockResolvedValue([target(1), target(2)])
    mocks.sendEmail.mockResolvedValue(true)

    expect(await sendReviewRequests()).toEqual({ sent: 2, failed: 0 })
    expect(REVIEW_EMAILS_PER_RUN).toBe(50)
    expect(mocks.listReviewRequestsDueRpc).toHaveBeenCalledWith(50)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hospede1@example.test',
        subject: 'Como foi sua estadia na Pousada Sol?',
      }),
    )
    expect(mocks.markReviewRequestSentRpc.mock.calls).toEqual([
      [target(1).bookingId],
      [target(2).bookingId],
    ])
    expect(mocks.sendEmail.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markReviewRequestSentRpc.mock.invocationCallOrder[0]!,
    )
  })

  it('falha de e-mail não marca como enviado e não impede as outras', async () => {
    mocks.listReviewRequestsDueRpc.mockResolvedValue([target(1), target(2), target(3)])
    mocks.sendEmail
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('SMTP caiu'))
      .mockResolvedValueOnce(true)

    const result = await silenced(() => sendReviewRequests())

    expect(result).toEqual({ sent: 1, failed: 2 })
    expect(mocks.markReviewRequestSentRpc).toHaveBeenCalledTimes(1)
    expect(mocks.markReviewRequestSentRpc).toHaveBeenCalledWith(target(3).bookingId)
  })

  it('falha ao marcar conta como falha e segue para a próxima', async () => {
    mocks.listReviewRequestsDueRpc.mockResolvedValue([target(1), target(2)])
    mocks.sendEmail.mockResolvedValue(true)
    mocks.markReviewRequestSentRpc.mockRejectedValueOnce(new Error('rede'))

    expect(await silenced(() => sendReviewRequests())).toEqual({ sent: 1, failed: 1 })
  })

  it('o log de falha não leva e-mail nem nome do hóspede', async () => {
    mocks.listReviewRequestsDueRpc.mockResolvedValue([target(1)])
    mocks.sendEmail.mockRejectedValue(new Error('SMTP caiu'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendReviewRequests()

    const logged = JSON.stringify(log.mock.calls)
    log.mockRestore()
    expect(logged).not.toContain('example.test')
    expect(logged).not.toContain('Ana')
  })

  it('erro ao listar sobe para o cron reportar a tarefa', async () => {
    mocks.listReviewRequestsDueRpc.mockRejectedValue(new Error('banco fora'))
    await expect(sendReviewRequests()).rejects.toThrow('banco fora')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('lembrete usa o template próprio e marca o lembrete, não o pedido', async () => {
    mocks.listReviewRemindersDueRpc.mockResolvedValue([target(1)])
    mocks.sendEmail.mockResolvedValue(true)

    expect(await sendReviewReminders()).toEqual({ sent: 1, failed: 0 })
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Ainda dá tempo: como foi sua estadia na Pousada Sol?',
      }),
    )
    expect(mocks.markReviewReminderSentRpc).toHaveBeenCalledWith(target(1).bookingId)
    expect(mocks.markReviewRequestSentRpc).not.toHaveBeenCalled()
  })

  it('lembrete com envio falho não é marcado', async () => {
    mocks.listReviewRemindersDueRpc.mockResolvedValue([target(1)])
    mocks.sendEmail.mockResolvedValue(false)

    expect(await sendReviewReminders()).toEqual({ sent: 0, failed: 1 })
    expect(mocks.markReviewReminderSentRpc).not.toHaveBeenCalled()
  })
})
