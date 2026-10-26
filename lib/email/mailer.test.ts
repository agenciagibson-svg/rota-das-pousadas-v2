import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }))
vi.mock('server-only', () => ({}))

import { maskRecipient, sendEmail, sendEmailWithResult } from './mailer'

const msg = { to: 'ana@gmail.com', subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' }

describe('maskRecipient', () => {
  it('mostra só o domínio', () => {
    expect(maskRecipient('ana.souza@gmail.com')).toBe('***@gmail.com')
    expect(maskRecipient('sem-arroba')).toBe('***')
  })
})

describe('sendEmailWithResult', () => {
  beforeEach(() => {
    sendMail.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('SMTP_HOST', 'smtp.resend.com')
    vi.stubEnv('SMTP_PORT', '465')
    vi.stubEnv('SMTP_USER', 'resend')
    vi.stubEnv('SMTP_PASS', 'chave')
    vi.stubEnv('SMTP_FROM', 'reservas@rotadaspousadas.com.br')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('envia com o remetente do domínio próprio', async () => {
    sendMail.mockResolvedValue({})
    const r = await sendEmailWithResult(msg)
    expect(r).toEqual({
      status: 'enviado',
      from: 'reservas@rotadaspousadas.com.br',
      host: 'smtp.resend.com',
    })
    expect(sendMail.mock.calls[0][0].from).toBe('"Rota das Pousadas" <reservas@rotadaspousadas.com.br>')
  })

  it('devolve o código quando o servidor recusa, sem lançar', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('auth'), { code: 'EAUTH' }))
    const r = await sendEmailWithResult(msg)
    expect(r).toMatchObject({ status: 'falhou', code: 'EAUTH' })
    expect(await sendEmail(msg)).toBe(false)
  })

  it('sem usuário/senha não tenta enviar', async () => {
    vi.stubEnv('SMTP_PASS', '')
    expect(await sendEmailWithResult(msg)).toEqual({ status: 'sem-config' })
    expect(sendMail).not.toHaveBeenCalled()
  })
})
