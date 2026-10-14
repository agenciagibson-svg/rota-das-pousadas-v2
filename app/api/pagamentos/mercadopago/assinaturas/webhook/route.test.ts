import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  processPreapproval: vi.fn(),
  processAuthorizedPayment: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/features/pagamentos/services/webhook.service', () => ({
  verifyWebhookSignature: mocks.verify,
}))
vi.mock('@/features/pagamentos/services/subscription.service', () => ({
  processSubscriptionPreapprovalNotification: mocks.processPreapproval,
  processSubscriptionAuthorizedPaymentNotification: mocks.processAuthorizedPayment,
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const URL_BASE = 'http://localhost/api/pagamentos/mercadopago/assinaturas/webhook'

function request(
  body: unknown = { type: 'subscription_preapproval', data: { id: 'pre-abc123' } },
  options: { query?: string; rawBody?: string } = {},
) {
  return new NextRequest(`${URL_BASE}${options.query ?? ''}`, {
    method: 'POST',
    headers: { 'x-signature': 'ts=1704908010,v1=abc', 'x-request-id': 'req-1' },
    body: options.rawBody ?? JSON.stringify(body),
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

describe('webhook de assinaturas do Mercado Pago', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.verify.mockReturnValue(true)
    mocks.processPreapproval.mockResolvedValue(undefined)
    mocks.processAuthorizedPayment.mockResolvedValue(undefined)
    mocks.reportError.mockResolvedValue(undefined)
  })

  describe('assinatura (HMAC)', () => {
    it('rejeita assinatura inválida com 401 e não processa nada', async () => {
      mocks.verify.mockReturnValue(false)

      const response = await POST(request())

      expect(response.status).toBe(401)
      expect(mocks.processPreapproval).not.toHaveBeenCalled()
      expect(mocks.processAuthorizedPayment).not.toHaveBeenCalled()
    })

    it('tipo desconhecido com assinatura inválida também recebe 401 (não vaza "ignored")', async () => {
      mocks.verify.mockReturnValue(false)

      const response = await POST(request({ type: 'payment', data: { id: '123' } }))

      expect(response.status).toBe(401)
    })

    it('confere a assinatura com os cabeçalhos da requisição e o id notificado', async () => {
      await POST(request())

      expect(mocks.verify).toHaveBeenCalledWith({
        xSignatureHeader: 'ts=1704908010,v1=abc',
        xRequestId: 'req-1',
        dataId: 'pre-abc123',
      })
    })
  })

  describe('tipos de notificação', () => {
    it('subscription_preapproval atualiza a assinatura e confirma com 200', async () => {
      const response = await POST(request())

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      expect(mocks.processPreapproval).toHaveBeenCalledWith('pre-abc123')
      expect(mocks.processAuthorizedPayment).not.toHaveBeenCalled()
    })

    it('subscription_authorized_payment registra a cobrança e confirma com 200', async () => {
      const response = await POST(
        request({ type: 'subscription_authorized_payment', data: { id: 987654 } }),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      // id numérico chega normalizado como texto
      expect(mocks.processAuthorizedPayment).toHaveBeenCalledWith('987654')
      expect(mocks.processPreapproval).not.toHaveBeenCalled()
    })

    it('tipo desconhecido com assinatura válida: 200 ignored, sem processar (evita reenvio por dias)', async () => {
      const response = await POST(request({ type: 'payment', data: { id: '123' } }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ignored: true })
      expect(mocks.processPreapproval).not.toHaveBeenCalled()
      expect(mocks.processAuthorizedPayment).not.toHaveBeenCalled()
    })
  })

  describe('falha no processamento', () => {
    it('falha temporária devolve 503 para o Mercado Pago tentar de novo', async () => {
      mocks.processPreapproval.mockRejectedValue(new Error('banco indisponível'))

      const response = await silenced(() => POST(request()))

      expect(response.status).toBe(503)
      expect(mocks.reportError).toHaveBeenCalledTimes(1)
    })

    it('a resposta de falha não expõe a mensagem técnica do erro', async () => {
      mocks.processAuthorizedPayment.mockRejectedValue(
        new Error('duplicate key value violates unique constraint "subscription_invoices_pkey"'),
      )

      const response = await silenced(() =>
        POST(request({ type: 'subscription_authorized_payment', data: { id: '555' } })),
      )

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'processing_failed' })
    })

    it('erro inesperado ao conferir a assinatura (ex.: segredo ausente) também vira 503, sem processar', async () => {
      mocks.verify.mockImplementation(() => {
        throw new Error('MERCADO_PAGO_WEBHOOK_SECRET ausente')
      })

      const response = await silenced(() => POST(request()))

      expect(response.status).toBe(503)
      expect(mocks.processPreapproval).not.toHaveBeenCalled()
    })
  })

  describe('payload', () => {
    it('data.id da query diferente do corpo: 400, sem conferir assinatura nem processar', async () => {
      const response = await POST(request(undefined, { query: '?data.id=outro-id' }))

      expect(response.status).toBe(400)
      expect(mocks.verify).not.toHaveBeenCalled()
      expect(mocks.processPreapproval).not.toHaveBeenCalled()
    })

    it('data.id da query igual ao do corpo é aceito', async () => {
      const response = await POST(request(undefined, { query: '?data.id=pre-abc123' }))

      expect(response.status).toBe(200)
      expect(mocks.processPreapproval).toHaveBeenCalledWith('pre-abc123')
    })

    it.each([
      ['corpo que não é JSON', undefined, '<html>'],
      ['sem data.id', { type: 'subscription_preapproval', data: {} }, undefined],
      ['sem type', { data: { id: 'pre-abc123' } }, undefined],
      [
        'id com caracteres de caminho',
        { type: 'subscription_preapproval', data: { id: '../x' } },
        undefined,
      ],
      ['id negativo', { type: 'subscription_preapproval', data: { id: -5 } }, undefined],
      [
        'id longo demais',
        { type: 'subscription_preapproval', data: { id: 'a'.repeat(61) } },
        undefined,
      ],
    ])('rejeita com 400: %s', async (_label, body, rawBody) => {
      const response = await POST(request(body, { rawBody }))

      expect(response.status).toBe(400)
      expect(mocks.verify).not.toHaveBeenCalled()
      expect(mocks.processPreapproval).not.toHaveBeenCalled()
      expect(mocks.processAuthorizedPayment).not.toHaveBeenCalled()
    })
  })
})
