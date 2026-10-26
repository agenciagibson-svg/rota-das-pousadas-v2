import 'server-only'
import {
  documentNumberLast4,
  encryptDocumentNumber,
  hashDocumentNumberForLookup,
  readStoredDocumentNumber,
} from '@/lib/crypto/document-cipher'
import {
  applyGuestProfileBackfillRpc,
  listGuestsPendingProfileBackfillRpc,
  type BackfillDocument,
} from '@/repositories/guest-profile-backfill.repository'

/**
 * Completa as fichas de hóspede (`guests`) de reservas feitas antes do
 * cadastro do viajante (0073), a partir do perfil dele — rotina única,
 * disparada pelo master no /admin (0097).
 *
 * - Só campo VAZIO da ficha é preenchido; o banco recalcula isso com a linha
 *   travada, então nada que a pousada digitou é sobrescrito.
 * - Só fichas de quem fez reserva naquela pousada (a mesma situação em que
 *   `ensure_traveler_guest` já copiaria os dados na reserva seguinte).
 * - Documento: o perfil guarda o número cifrado (mesma chave da ficha). Aqui
 *   ele é decifrado, conferido contra o hash do perfil e cifrado de novo com
 *   hash e 4 últimos dígitos — a cifra é sempre no Node, nunca no SQL. Se não
 *   decifrar com a chave deste ambiente, o documento fica de fora (os outros
 *   campos seguem) e a ficha conta como falha.
 * - Idempotente: rodar de novo não muda nada (não há mais campo vazio a
 *   preencher). Fichas cujo único pendente é um documento ilegível voltam a
 *   aparecer como falha — sem mudar dado nenhum.
 */

/** Tamanho da página e teto de páginas por execução (a action tem tempo limitado). */
export const GUEST_BACKFILL_PAGE = 200
export const GUEST_BACKFILL_MAX_PAGES = 25

export type GuestProfileBackfillResult = {
  /** Fichas em que pelo menos um campo foi preenchido. */
  completed: number
  /** Fichas que não puderam ser completadas (erro, ou só faltava um documento ilegível). */
  failed: number
  /** Documentos de perfil que não decifraram com a chave atual (ficaram de fora). */
  documentsSkipped: number
  /** Ainda havia fichas quando o teto de páginas foi atingido: rodar de novo continua. */
  hasMore: boolean
}

/** Documento do perfil pronto para a ficha, ou `null` se não der para confiar nele. */
export function prepareDocumentForGuest(
  storedProfileDocument: string | null,
  profileHash: string | null,
): BackfillDocument | null {
  if (!storedProfileDocument || !profileHash) return null
  const plain = readStoredDocumentNumber(storedProfileDocument)
  if (!plain || !plain.trim()) return null
  const hash = hashDocumentNumberForLookup(plain)
  // Hash diferente = chave diferente (ou dado corrompido): não grava.
  if (hash !== profileHash) return null
  return { number: encryptDocumentNumber(plain), hash, last4: documentNumberLast4(plain) }
}

export async function backfillGuestProfilesFromTravelers(): Promise<GuestProfileBackfillResult> {
  const result: GuestProfileBackfillResult = {
    completed: 0,
    failed: 0,
    documentsSkipped: 0,
    hasMore: false,
  }
  let after: string | null = null
  for (let page = 0; page < GUEST_BACKFILL_MAX_PAGES; page++) {
    const rows = await listGuestsPendingProfileBackfillRpc(after, GUEST_BACKFILL_PAGE)
    for (const row of rows) {
      let document: BackfillDocument | null = null
      let documentSkipped = false
      try {
        if (row.fields.includes('document')) {
          document = prepareDocumentForGuest(
            row.profileDocumentNumber,
            row.profileDocumentNumberHash,
          )
          if (!document) {
            documentSkipped = true
            result.documentsSkipped++
          }
        }
        const filled = await applyGuestProfileBackfillRpc(row.guestId, document)
        if (filled.length > 0) result.completed++
        else if (documentSkipped) result.failed++
        // Lista vazia sem documento ilegível: alguém completou a ficha entre a
        // listagem e a aplicação — nada a fazer, não é falha.
      } catch (error) {
        result.failed++
        // Sem nome, documento ou contato no log (LGPD): só a ficha e o erro.
        console.error('[fichas] falha ao completar ficha pelo perfil', {
          guestId: row.guestId,
          error: String(error),
        })
      }
    }
    if (rows.length < GUEST_BACKFILL_PAGE) return result
    after = rows[rows.length - 1].guestId
  }
  result.hasMore = true
  return result
}
