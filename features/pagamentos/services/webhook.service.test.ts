import { createHmac } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import { verifyWebhookSignature } from './webhook.service'

const SECRET = 'test-webhook-secret'

function buildSignatureHeader(params: {
  dataId: string
  requestId: string
  ts: string
  secret?: string
}) {
  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.requestId};ts:${params.ts};`
  const v1 = createHmac('sha256', params.secret ?? SECRET)
    .update(manifest)
    .digest('hex')
  return `ts=${params.ts},v1=${v1}`
}

beforeAll(() => {
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = SECRET
})

describe('verifyWebhookSignature', () => {
  it('aceita uma assinatura válida com ts recente', () => {
    const ts = String(Date.now())
    const xSignatureHeader = buildSignatureHeader({ dataId: '123456789', requestId: 'req-1', ts })
    expect(
      verifyWebhookSignature({ xSignatureHeader, xRequestId: 'req-1', dataId: '123456789' }),
    ).toBe(true)
  })

  it('rejeita quando o secret usado pra assinar é outro', () => {
    const ts = String(Date.now())
    const xSignatureHeader = buildSignatureHeader({
      dataId: '123456789',
      requestId: 'req-1',
      ts,
      secret: 'secret-errado',
    })
    expect(
      verifyWebhookSignature({ xSignatureHeader, xRequestId: 'req-1', dataId: '123456789' }),
    ).toBe(false)
  })

  it('rejeita quando o dataId foi trocado depois de assinado', () => {
    const ts = String(Date.now())
    const xSignatureHeader = buildSignatureHeader({ dataId: '123456789', requestId: 'req-1', ts })
    expect(
      verifyWebhookSignature({ xSignatureHeader, xRequestId: 'req-1', dataId: '999999999' }),
    ).toBe(false)
  })

  it('rejeita quando falta o header x-signature ou x-request-id', () => {
    expect(
      verifyWebhookSignature({ xSignatureHeader: null, xRequestId: 'req-1', dataId: '1' }),
    ).toBe(false)
    expect(
      verifyWebhookSignature({ xSignatureHeader: 'ts=1,v1=abc', xRequestId: null, dataId: '1' }),
    ).toBe(false)
  })

  it('rejeita uma assinatura válida com ts velho (replay)', () => {
    // Assinatura matematicamente correta, mas de uma notificação de 20 minutos
    // atrás — capturada e reenviada depois. Mesmo com HMAC batendo, deve cair.
    const ts = String(Date.now() - 20 * 60 * 1000)
    const xSignatureHeader = buildSignatureHeader({ dataId: '123456789', requestId: 'req-1', ts })
    expect(
      verifyWebhookSignature({ xSignatureHeader, xRequestId: 'req-1', dataId: '123456789' }),
    ).toBe(false)
  })

  it('rejeita ts no futuro além da tolerância de relógio', () => {
    const ts = String(Date.now() + 20 * 60 * 1000)
    const xSignatureHeader = buildSignatureHeader({ dataId: '123456789', requestId: 'req-1', ts })
    expect(
      verifyWebhookSignature({ xSignatureHeader, xRequestId: 'req-1', dataId: '123456789' }),
    ).toBe(false)
  })
})
