import 'server-only'
import { randomBytes, createCipheriv, createDecipheriv, createHmac, scryptSync } from 'node:crypto'

/**
 * Cifra o documento (CPF/RG/passaporte) do hóspede antes de gravar no banco —
 * achado de LGPD da auditoria de 14/09/2026, implementado em 21/09/2026.
 * Mesmo padrão de `token-cipher.ts` (AES-256-GCM, chave fora do banco), com
 * uma peça extra: o documento precisa continuar buscável (achar hóspede
 * repetido ao criar reserva) mesmo cifrado, o que uma cifra não-determinística
 * como AES-GCM não permite comparar direto no banco. A saída é um "índice
 * cego": `hashDocumentNumberForLookup` gera um HMAC determinístico (mesmo
 * documento → mesmo hash sempre) que vai numa coluna separada
 * (`guests.document_number_hash`) só pra casar duplicata — nunca pra exibir.
 *
 * Reaproveita `PAYMENT_TOKENS_ENCRYPTION_KEY` como segredo-base (Gibson já
 * tem essa variável configurada; não precisa caçar mais uma credencial), mas
 * deriva DUAS subchaves com sal de domínio próprio — mesma separação de
 * domínio que corrigiu o reuso de chave em `oauth-state.ts` (0053). Vazar uma
 * subchave não expõe a outra função sem também vazar o segredo-base.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getSecret(): string {
  const secret = process.env.PAYMENT_TOKENS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'PAYMENT_TOKENS_ENCRYPTION_KEY não configurada — não é possível cifrar documento de hóspede.',
    )
  }
  return secret
}

function getCipherKey(): Buffer {
  return scryptSync(getSecret(), 'rota-das-pousadas-document-numbers', 32)
}

function getHashKey(): Buffer {
  return scryptSync(getSecret(), 'rota-das-pousadas-document-hash', 32)
}

/**
 * Remove pontuação comum de CPF/RG/passaporte (ponto, traço, barra, espaço) e
 * padroniza maiúsculas, pra "123.456.789-00" e "12345678900" produzirem o
 * mesmo hash e não deixarem passar duplicata de hóspede por formatação.
 */
function normalizeDocumentNumber(plain: string): string {
  return plain
    .trim()
    .toUpperCase()
    .replace(/[.\-/\s]/g, '')
}

/** Retorna `iv:authTag:ciphertext`, tudo em base64 — mesmo formato de `encryptToken`. */
export function encryptDocumentNumber(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getCipherKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  )
}

export function decryptDocumentNumber(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Documento de hóspede cifrado em formato inválido.')
  }
  const decipher = createDecipheriv(ALGORITHM, getCipherKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plain.toString('utf8')
}

/** HMAC-SHA256 (hex) do documento normalizado — determinístico, nunca reversível. */
export function hashDocumentNumberForLookup(plain: string): string {
  return createHmac('sha256', getHashKey()).update(normalizeDocumentNumber(plain)).digest('hex')
}

/** Últimos 4 caracteres do documento normalizado, em claro — só pra mascarar na listagem. */
export function documentNumberLast4(plain: string): string {
  const normalized = normalizeDocumentNumber(plain)
  return normalized.slice(-4)
}

/**
 * Decifra sem lançar — uma linha antiga, corrompida, ou gravada antes do
 * backfill não deve derrubar a tela inteira (guest detail, FNRH). Loga e
 * volta `null`, que os componentes já tratam como "documento não informado".
 */
export function safeDecryptDocumentNumber(encrypted: string | null): string | null {
  if (!encrypted) return null
  try {
    return decryptDocumentNumber(encrypted)
  } catch {
    console.error(
      '[document-cipher] falha ao decifrar document_number — retornando null pra não quebrar a tela.',
    )
    return null
  }
}
