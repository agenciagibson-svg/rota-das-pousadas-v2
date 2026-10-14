import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  process: vi.fn(),
  notifyReviews: vi.fn(),
  NoPaymentAccountError: class NoPaymentAccountError extends Error {},
}))
vi.mock('@/features/pagamentos/services/webhook.service', () => ({
  verifyWebhookSignature: mocks.verify,
  processPaymentNotification: mocks.process,
  NoPaymentAccountError: mocks.NoPaymentAccountError,
}))
vi.mock('@/features/pagamentos/services/pix.service', () => ({
  notifyPaymentReviews: mocks.notifyReviews,
}))
const bookingId = '30000000-0000-0000-0000-000000000001'
function request(body: unknown = { type: 'payment', data: { id: 123 } }) {
  return new NextRequest(
    `http://localhost/api/pagamentos/mercadopago/webhook?bookingId=${bookingId}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}
describe('webhook HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockReturnValue(true)
    mocks.process.mockResolvedValue(undefined)
  })
  it('normaliza ID numérico e confirma apenas após processar', async () => {
    expect((await POST(request())).status).toBe(200)
    expect(mocks.process).toHaveBeenCalledWith({ bookingId, mpPaymentId: '123' })
  })
  it('retorna 503 para falha temporária, permitindo retry do provedor', async () => {
    mocks.process.mockRejectedValue(new Error('banco indisponível'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect((await POST(request())).status).toBe(503)
    } finally {
      log.mockRestore()
    }
  })
  it('confirma (200 ignored) quando a reserva não tem conta conectada — sem retry do provedor', async () => {
    mocks.process.mockRejectedValue(new mocks.NoPaymentAccountError('sem conta'))
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const response = await POST(request())
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ignored: true })
    } finally {
      log.mockRestore()
    }
  })
  it('rejeita assinatura inválida sem processar', async () => {
    mocks.verify.mockReturnValue(false)
    expect((await POST(request())).status).toBe(401)
    expect(mocks.process).not.toHaveBeenCalled()
  })
  it('rejeita payload inválido', async () => {
    expect((await POST(request({ data: { id: '../x' } }))).status).toBe(400)
    expect(mocks.process).not.toHaveBeenCalled()
  })
})
