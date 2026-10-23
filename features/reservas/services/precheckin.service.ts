import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import {
  documentNumberLast4,
  encryptDocumentNumber,
  hashDocumentNumberForLookup,
} from '@/lib/crypto/document-cipher'
import { lookupCep } from '@/lib/cep'
import { getMyPrecheckinRpc, submitPrecheckinRpc } from '@/repositories/precheckin.repository'
import {
  companionLimitError,
  nationalityLabel,
  type PrecheckinInput,
  type PrecheckinSnapshot,
} from '../precheckin'

/** Ficha da reserva do hóspede logado. `null` = sem login, reserva alheia ou inexistente. */
export async function getMyPrecheckin(bookingId: string): Promise<PrecheckinSnapshot | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return getMyPrecheckinRpc(bookingId)
}

/**
 * Envia o pré-check-in. O banco confere posse, status, tamanhos e tipos de
 * novo; aqui ficam o que só o app sabe fazer: cifrar documentos (o banco nunca
 * recebe documento em claro) e conferir o CEP.
 */
export async function submitMyPrecheckin(input: PrecheckinInput): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para enviar a ficha.')

  const current = await getMyPrecheckinRpc(input.bookingId)
  if (!current) throw new Error('Reserva não encontrada.')
  if (!current.canSubmit) throw new Error('A ficha só pode ser enviada antes do check-in.')

  const limit = companionLimitError(input.companions, current)
  if (limit) throw new Error(limit)

  const brazilian = input.nationality === 'brasileira'
  if (brazilian && input.cep) {
    const found = await lookupCep(input.cep)
    if (found === null) throw new Error('CEP não encontrado. Confira o número.')
    if (found !== 'unavailable' && found.state && found.state !== input.state.toUpperCase()) {
      throw new Error(`O CEP ${input.cep} é de ${found.city}/${found.state}. Confira a UF.`)
    }
  }

  const documentNumber = input.documentNumber.trim()
  const document = documentNumber
    ? {
        type: brazilian ? ('CPF' as const) : ('Passaporte' as const),
        encrypted: encryptDocumentNumber(documentNumber),
        hash: hashDocumentNumberForLookup(documentNumber),
        last4: documentNumberLast4(documentNumber),
      }
    : null

  const storedIds = new Set(current.companions.filter((c) => c.hasDocument).map((c) => c.id))

  await submitPrecheckinRpc({
    bookingId: input.bookingId,
    phone: input.phone.trim(),
    birthDate: input.birthDate,
    nationality: nationalityLabel(input.nationality),
    country: brazilian ? 'BR' : input.country.trim(),
    city: input.city.trim(),
    state: brazilian ? input.state.toUpperCase() : null,
    address: input.address.trim(),
    cep: brazilian && input.cep ? input.cep : null,
    document,
    companions: input.companions.map((c) => {
      const plain = c.documentNumber.trim()
      return {
        fullName: c.fullName.trim(),
        guestType: c.guestType,
        birthDate: c.birthDate || null,
        documentType: plain ? c.documentType || null : null,
        documentNumber: plain ? encryptDocumentNumber(plain) : null,
        // Só aponta para um documento antigo que exista nesta reserva.
        keepDocumentOf: !plain && storedIds.has(c.keepDocumentOf) ? c.keepDocumentOf : null,
      }
    }),
    expectedArrivalTime: input.expectedArrivalTime || null,
  })
}
