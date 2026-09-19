import 'server-only'
import { randomBytes, createHmac, timingSafeEqual, scryptSync } from 'node:crypto'

/**
 * `state` assinado do fluxo OAuth do Mercado Pago — carrega o pousada_id e
 * evita CSRF (alguém completar a conexão de uma pousada usando o retorno de
 * outra sessão). Nunca é a única checagem: o callback também confirma que o
 * usuário logado tem `proprietario`/`admin_pousada` ativo nessa pousada
 * antes de gravar (ver `features/pagamentos/services/oauth.service.ts`), e
 * o `nonce` embutido aqui é consumido uma única vez via
 * `consume_oauth_state_nonce` (migration 0053) — um `state` válido não pode
 * completar a conexão duas vezes, mesmo dentro da janela de 10 minutos.
 *
 * Validade de 10 minutos — mesma janela que o `code` de autorização do
 * Mercado Pago já usa.
 *
 * A chave de assinatura NUNCA é `PAYMENT_TOKENS_ENCRYPTION_KEY` bruta: seria
 * reusar o mesmo segredo para dois propósitos criptográficos diferentes
 * (cifrar token vs. autenticar state). `getSigningKey()` deriva uma subchave
 * própria, com `scryptSync` e salt fixo específico deste uso — mesmo padrão
 * de separação de domínio que `lib/crypto/token-cipher.ts` já usa para a
 * chave de cifra, só que com um salt diferente (não pode ser o mesmo, ou as
 * "duas chaves" seriam idênticas).
 */

const STATE_TTL_MS = 10 * 60 * 1000

function getSigningKey(): Buffer {
  const secret = process.env.PAYMENT_TOKENS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'PAYMENT_TOKENS_ENCRYPTION_KEY não configurada — não é possível assinar o state do OAuth.',
    )
  }
  return scryptSync(secret, 'rota-das-pousadas-oauth-state', 32)
}

function sign(payload: string): string {
  return createHmac('sha256', getSigningKey()).update(payload).digest('base64url')
}

export function signState(pousadaId: string): string {
  const nonce = randomBytes(8).toString('base64url')
  const expiresAt = Date.now() + STATE_TTL_MS
  const payload = `${pousadaId}.${nonce}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function verifyState(state: string): { pousadaId: string; nonce: string } | null {
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

  return { pousadaId, nonce }
}
