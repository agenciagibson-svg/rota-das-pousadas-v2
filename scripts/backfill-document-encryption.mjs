// Backfill (migrations 0058 e 0083): cifra o document_number em claro dos
// hóspedes já cadastrados (com hash de busca e últimos 4 dígitos) e, desde a
// 0083, o documento dos acompanhantes (`booking_guests`).
//
// Roda depois que a migration correspondente já foi aplicada em produção
// (`npx supabase db push`). Idempotente: pode rodar de novo sem medo — a RPC
// `apply_document_backfill` só toca linha que ainda não tem
// `document_number_hash` preenchido.
//
// Não importa `lib/crypto/document-cipher.ts` de propósito: aquele módulo
// tem `import 'server-only'`, que só funciona dentro do bundler do Next.
// Este script roda como Node puro, então a lógica de cifra é duplicada aqui
// — mesmo algoritmo, mesmas chaves derivadas, byte a byte igual ao módulo
// real (qualquer mudança num dos dois precisa ir pro outro também).
//
// Uso:
//   node --env-file=.env.local scripts/backfill-document-encryption.mjs
//
// Precisa de SUPABASE_SERVICE_ROLE_KEY e PAYMENT_TOKENS_ENCRYPTION_KEY no
// .env.local (as mesmas já configuradas pra rodar o projeto).

import { createClient } from '@supabase/supabase-js'
import { randomBytes, createCipheriv, createHmac, scryptSync } from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CIPHER_SECRET = process.env.PAYMENT_TOKENS_ENCRYPTION_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CIPHER_SECRET) {
  console.error(
    'Faltam variáveis de ambiente. Confirme NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e PAYMENT_TOKENS_ENCRYPTION_KEY em .env.local, e rode com: node --env-file=.env.local scripts/backfill-document-encryption.mjs',
  )
  process.exit(1)
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getCipherKey() {
  return scryptSync(CIPHER_SECRET, 'rota-das-pousadas-document-numbers', 32)
}
function getHashKey() {
  return scryptSync(CIPHER_SECRET, 'rota-das-pousadas-document-hash', 32)
}
function normalizeDocumentNumber(plain) {
  return plain
    .trim()
    .toUpperCase()
    .replace(/[.\-/\s]/g, '')
}
function encryptDocumentNumber(plain) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getCipherKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  )
}
function hashDocumentNumberForLookup(plain) {
  return createHmac('sha256', getHashKey()).update(normalizeDocumentNumber(plain)).digest('hex')
}
function documentNumberLast4(plain) {
  return normalizeDocumentNumber(plain).slice(-4)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let totalOk = 0
let totalFail = 0

for (;;) {
  const { data: rows, error: listError } = await supabase.rpc(
    'list_guests_pending_document_backfill',
    {
      p_limit: 200,
    },
  )
  if (listError) {
    console.error('Falha ao listar hóspedes pendentes:', listError.message)
    process.exit(1)
  }
  if (!rows || rows.length === 0) break

  for (const row of rows) {
    const plain = (row.document_number ?? '').trim()
    if (!plain) continue
    try {
      const encrypted = encryptDocumentNumber(plain)
      const hash = hashDocumentNumberForLookup(plain)
      const last4 = documentNumberLast4(plain)
      const { error: applyError } = await supabase.rpc('apply_document_backfill', {
        p_guest_id: row.id,
        p_document_number_encrypted: encrypted,
        p_document_number_hash: hash,
        p_document_last4: last4,
      })
      if (applyError) throw new Error(applyError.message)
      totalOk += 1
    } catch (err) {
      totalFail += 1
      console.error(`Falha no hóspede ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`Lote processado: +${rows.length} (acumulado ok=${totalOk}, falha=${totalFail})`)
}

console.log(`Hóspedes: cifrados com sucesso ${totalOk}, falhas ${totalFail}.`)

// --- Acompanhantes (migration 0083) -----------------------------------------
// `booking_guests.document_number` passou a ser gravado cifrado pelo app; aqui
// entram as linhas antigas, ainda em texto puro. Sem hash nem últimos 4: o
// documento do acompanhante só aparece na ficha da reserva (FNRH), nunca em
// busca ou listagem.
let companionsOk = 0
let companionsFail = 0
const companionFailures = new Set()

for (;;) {
  const { data: rows, error: listError } = await supabase.rpc(
    'list_booking_guests_pending_document_backfill',
    // Lote grande: linhas que falharam continuam pendentes e voltam na lista;
    // com lote pequeno, um punhado de falhas no começo escondia o resto.
    { p_limit: 2000 },
  )
  if (listError) {
    console.error('Falha ao listar acompanhantes pendentes:', listError.message)
    process.exit(1)
  }
  // Linhas que falharam continuam "pendentes" e voltariam para sempre no laço.
  const pending = (rows ?? []).filter((row) => !companionFailures.has(row.id))
  if (pending.length === 0) break

  for (const row of pending) {
    const plain = (row.document_number ?? '').trim()
    try {
      const { error: applyError } = await supabase.rpc('apply_booking_guest_document_backfill', {
        p_booking_guest_id: row.id,
        p_document_number_encrypted: encryptDocumentNumber(plain),
      })
      if (applyError) throw new Error(applyError.message)
      companionsOk += 1
    } catch (err) {
      companionsFail += 1
      companionFailures.add(row.id)
      console.error(`Falha no acompanhante ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(
    `Lote de acompanhantes: +${pending.length} (ok=${companionsOk}, falha=${companionsFail})`,
  )
}

console.log(`Acompanhantes: cifrados com sucesso ${companionsOk}, falhas ${companionsFail}.`)
console.log('Backfill concluído.')
if (totalFail > 0 || companionsFail > 0) process.exit(1)
