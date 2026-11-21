import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  due: vi.fn(),
  mark: vi.fn(),
  email: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-capability', () => ({
  requireCapability: async () => ({ pousadaId: 'p-1', role: 'proprietario' }),
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: async () => null }))
vi.mock('@/lib/email/mailer', () => ({ sendEmail: mocks.email }))
vi.mock('@/repositories/offers.repository', () => ({
  sendPousadaOfferRpc: mocks.send,
  listOfferEmailsDueRpc: mocks.due,
  markOfferEmailRpc: mocks.mark,
}))

import { sendDueOfferEmails, sendOffer } from './offers.service'

const day = new Date('2026-12-10T10:00:00-03:00')
const night = new Date('2026-12-10T22:30:00-03:00')
const input = { percent: 15, validDays: 30, message: '' }
const target = (id: string) => ({
  deliveryId: id,
  email: `${id}@example.test`,
  guestName: '',
  pousadaName: 'Pousada',
  pousadaSlug: 'pousada',
  code: 'VOLTAAAAAAA',
  percent: 15,
  validUntil: '2027-01-09',
  stayFrom: null,
  stayUntil: null,
  message: '',
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mark.mockResolvedValue(undefined)
})

describe('enviar oferta', () => {
  it('de dia, cria e já manda os e-mails', async () => {
    mocks.send.mockResolvedValue({ offerId: 'o', sent: 2 })
    mocks.due.mockResolvedValue([target('a'), target('b')])
    mocks.email.mockResolvedValue(true)
    expect(await sendOffer(input, day)).toEqual({ sent: 2, emailed: 2, queued: false })
    expect(mocks.mark).toHaveBeenCalledWith('a', true)
  })

  it('de noite, cria e deixa os e-mails para a rodada das 10h', async () => {
    mocks.send.mockResolvedValue({ offerId: 'o', sent: 2 })
    expect(await sendOffer(input, night)).toEqual({ sent: 2, emailed: 0, queued: true })
    expect(mocks.due).not.toHaveBeenCalled()
  })

  it('sem ninguém para receber, não manda nada', async () => {
    mocks.send.mockResolvedValue({ offerId: null, sent: 0 })
    expect(await sendOffer(input, day)).toEqual({ sent: 0, emailed: 0, queued: false })
  })
})

describe('rodada de e-mails', () => {
  it('falha de um e-mail não para os outros e fica registrada', async () => {
    mocks.due.mockResolvedValue([target('a'), target('b')])
    mocks.email.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await sendDueOfferEmails(50, day)).toEqual({ sent: 1, failed: 1 })
    expect(mocks.mark).toHaveBeenCalledWith('a', false)
    expect(mocks.mark).toHaveBeenCalledWith('b', true)
  })

  it('fora do horário não envia', async () => {
    expect(await sendDueOfferEmails(50, night)).toEqual({
      sent: 0,
      failed: 0,
      skipped: 'fora_do_horario',
    })
    expect(mocks.due).not.toHaveBeenCalled()
  })
})
