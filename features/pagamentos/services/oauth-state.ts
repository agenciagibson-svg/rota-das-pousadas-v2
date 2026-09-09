import 'server-only'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * `state` assinado do fluxo OAuth do Mercado Pago — carrega o pousada_id e
 * evita CSRF (alguém completar a conexão de uma pousada usando o retorno de
 * outra sessão). Nunca é a única checagem: o callback também confirma que o
 * usuário logado tem `proprietario`/`admin_pousada` ativo nessa pousada
 * antes de gravar (ver `features/pagamentos/services/oauth.service.ts`).
 *
 * Validade de 10 minutos — mesma janela que o `code` de autorização do
 * Mercado Pago já usa.
 */

const STATE_TTL_MS = 10 * 60 * 1000

function getSecret(): string {
  const secret = process.env.PAYMENT_TOKENS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYMENT_TOKENS_ENCRYPTION_KEY não configurada — não é possível assinar o state do OAuth.')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function signState(pousadaId: string): string {
  const nonce = randomBytes(8).toString('base64url')
  const expiresAt = Date.now() + STATE_TTL_MS
  const payload = `${pousadaId}.${nonce}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function verifyState(state: string): { pousadaId: string } | null {
  const parts = state.split('.')
  if (parts.length !== 4) return null
  const [pousadaId, nonce, expiresAtRaw, signature] = parts
  const payload = `${pousadaId}.${nonce}.${expiresAtRaw}`
  const expected = sign(payload)

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null

  return { pousadaId }
}
