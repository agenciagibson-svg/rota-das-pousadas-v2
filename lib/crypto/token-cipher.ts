import 'server-only'
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto'

/**
 * Cifra tokens de contas de pagamento de terceiros (Mercado Pago) antes de
 * gravar no banco. Chave fora do banco de propósito — defesa em profundidade
 * caso o Postgres seja comprometido isoladamente. Ver `pousada_payment_accounts`
 * (migration 0039) e `lib/supabase/service.ts` para o padrão irmão de segredo
 * server-only.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const secret = process.env.PAYMENT_TOKENS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYMENT_TOKENS_ENCRYPTION_KEY não configurada — não é possível cifrar tokens de pagamento.')
  }
  return scryptSync(secret, 'rota-das-pousadas-payment-tokens', 32)
}

/** Retorna `iv:authTag:ciphertext`, tudo em base64. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptToken(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Token de pagamento cifrado em formato inválido.')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()])
  return plain.toString('utf8')
}
