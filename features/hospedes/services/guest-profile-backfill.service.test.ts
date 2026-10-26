import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listGuestsPendingProfileBackfillRpc: vi.fn(),
  applyGuestProfileBackfillRpc: vi.fn(),
}))
vi.mock('@/repositories/guest-profile-backfill.repository', () => ({
  listGuestsPendingProfileBackfillRpc: mocks.listGuestsPendingProfileBackfillRpc,
  applyGuestProfileBackfillRpc: mocks.applyGuestProfileBackfillRpc,
}))

import {
  decryptDocumentNumber,
  documentNumberLast4,
  encryptDocumentNumber,
  hashDocumentNumberForLookup,
} from '@/lib/crypto/document-cipher'
import {
  GUEST_BACKFILL_MAX_PAGES,
  GUEST_BACKFILL_PAGE,
  backfillGuestProfilesFromTravelers,
  prepareDocumentForGuest,
} from './guest-profile-backfill.service'

// Chave e CPF sintéticos, só para o teste.
const KEY = 'chave-de-teste-backfill-0097'
const CPF = '123.456.789-09'

function profileDoc() {
  return { number: encryptDocumentNumber(CPF), hash: hashDocumentNumberForLookup(CPF) }
}

const id = (n: number) => `40000000-0000-0000-0000-${String(n).padStart(12, '0')}`

async function silenced<T>(run: () => Promise<T>): Promise<T> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return await run()
  } finally {
    log.mockRestore()
  }
}

describe('completar fichas antigas pelo perfil do viajante', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('PAYMENT_TOKENS_ENCRYPTION_KEY', KEY)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('documento: decifra, confere e cifra de novo no Node', () => {
    it('documento do perfil vira um novo valor cifrado com o mesmo hash e 4 últimos', () => {
      const doc = profileDoc()
      const prepared = prepareDocumentForGuest(doc.number, doc.hash)
      expect(prepared).not.toBeNull()
      expect(prepared!.number).not.toContain('123')
      expect(prepared!.number).not.toBe(doc.number) // IV novo
      expect(decryptDocumentNumber(prepared!.number)).toBe(CPF)
      expect(prepared!.hash).toBe(doc.hash)
      expect(prepared!.last4).toBe(documentNumberLast4(CPF))
    })

    it('cifrado com outra chave: fica de fora (não grava lixo na ficha)', () => {
      vi.stubEnv('PAYMENT_TOKENS_ENCRYPTION_KEY', 'outra-chave-de-outro-ambiente')
      const foreign = profileDoc()
      vi.stubEnv('PAYMENT_TOKENS_ENCRYPTION_KEY', KEY)
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(prepareDocumentForGuest(foreign.number, foreign.hash)).toBeNull()
      log.mockRestore()
    })

    it('hash que não bate com o documento: fica de fora', () => {
      const doc = profileDoc()
      expect(prepareDocumentForGuest(doc.number, 'hash-de-outra-pessoa')).toBeNull()
      expect(prepareDocumentForGuest(null, doc.hash)).toBeNull()
      expect(prepareDocumentForGuest(doc.number, null)).toBeNull()
    })
  })

  it('completa cada ficha pendente e manda o documento recifrado à RPC', async () => {
    const doc = profileDoc()
    mocks.listGuestsPendingProfileBackfillRpc.mockResolvedValueOnce([
      {
        guestId: id(1),
        fields: ['phone', 'document'],
        profileDocumentNumber: doc.number,
        profileDocumentNumberHash: doc.hash,
      },
      {
        guestId: id(2),
        fields: ['city'],
        profileDocumentNumber: null,
        profileDocumentNumberHash: null,
      },
    ])
    mocks.applyGuestProfileBackfillRpc
      .mockResolvedValueOnce(['phone', 'document'])
      .mockResolvedValueOnce(['city'])

    expect(await backfillGuestProfilesFromTravelers()).toEqual({
      completed: 2,
      failed: 0,
      documentsSkipped: 0,
      hasMore: false,
    })
    expect(mocks.listGuestsPendingProfileBackfillRpc).toHaveBeenCalledWith(
      null,
      GUEST_BACKFILL_PAGE,
    )
    const [guestId, sent] = mocks.applyGuestProfileBackfillRpc.mock.calls[0]
    expect(guestId).toBe(id(1))
    expect(sent.hash).toBe(doc.hash)
    expect(sent.last4).toBe('8909')
    expect(decryptDocumentNumber(sent.number)).toBe(CPF)
    // Sem documento pendente, a RPC não recebe documento nenhum.
    expect(mocks.applyGuestProfileBackfillRpc).toHaveBeenCalledWith(id(2), null)
  })

  it('documento ilegível: o resto da ficha segue; se só faltava ele, conta como falha', async () => {
    vi.stubEnv('PAYMENT_TOKENS_ENCRYPTION_KEY', 'outra-chave-de-outro-ambiente')
    const foreign = profileDoc()
    vi.stubEnv('PAYMENT_TOKENS_ENCRYPTION_KEY', KEY)
    mocks.listGuestsPendingProfileBackfillRpc.mockResolvedValueOnce([
      {
        guestId: id(1),
        fields: ['phone', 'document'],
        profileDocumentNumber: foreign.number,
        profileDocumentNumberHash: foreign.hash,
      },
      {
        guestId: id(2),
        fields: ['document'],
        profileDocumentNumber: foreign.number,
        profileDocumentNumberHash: foreign.hash,
      },
    ])
    mocks.applyGuestProfileBackfillRpc.mockResolvedValueOnce(['phone']).mockResolvedValueOnce([])

    const result = await silenced(() => backfillGuestProfilesFromTravelers())

    expect(result).toEqual({ completed: 1, failed: 1, documentsSkipped: 2, hasMore: false })
    expect(mocks.applyGuestProfileBackfillRpc).toHaveBeenNthCalledWith(1, id(1), null)
    expect(mocks.applyGuestProfileBackfillRpc).toHaveBeenNthCalledWith(2, id(2), null)
  })

  it('erro numa ficha não para as outras', async () => {
    mocks.listGuestsPendingProfileBackfillRpc.mockResolvedValueOnce([
      {
        guestId: id(1),
        fields: ['phone'],
        profileDocumentNumber: null,
        profileDocumentNumberHash: null,
      },
      {
        guestId: id(2),
        fields: ['phone'],
        profileDocumentNumber: null,
        profileDocumentNumberHash: null,
      },
    ])
    mocks.applyGuestProfileBackfillRpc
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(['phone'])

    const result = await silenced(() => backfillGuestProfilesFromTravelers())

    expect(result).toMatchObject({ completed: 1, failed: 1 })
  })

  it('idempotente: sem pendência, nada é aplicado', async () => {
    mocks.listGuestsPendingProfileBackfillRpc.mockResolvedValue([])

    expect(await backfillGuestProfilesFromTravelers()).toEqual({
      completed: 0,
      failed: 0,
      documentsSkipped: 0,
      hasMore: false,
    })
    expect(mocks.applyGuestProfileBackfillRpc).not.toHaveBeenCalled()
  })

  it('ficha completada por outra pessoa entre a listagem e a aplicação não é falha', async () => {
    mocks.listGuestsPendingProfileBackfillRpc.mockResolvedValueOnce([
      {
        guestId: id(1),
        fields: ['phone'],
        profileDocumentNumber: null,
        profileDocumentNumberHash: null,
      },
    ])
    mocks.applyGuestProfileBackfillRpc.mockResolvedValueOnce([])

    expect(await backfillGuestProfilesFromTravelers()).toMatchObject({ completed: 0, failed: 0 })
  })

  it('pagina pelo id da última ficha e para no teto de páginas', async () => {
    const page = (start: number) =>
      Array.from({ length: GUEST_BACKFILL_PAGE }, (_, i) => ({
        guestId: id(start + i),
        fields: ['phone'],
        profileDocumentNumber: null,
        profileDocumentNumberHash: null,
      }))
    mocks.listGuestsPendingProfileBackfillRpc.mockImplementation(async (after: string | null) => {
      const start = after ? Number(after.slice(-12)) + 1 : 1
      return page(start)
    })
    mocks.applyGuestProfileBackfillRpc.mockResolvedValue(['phone'])

    const result = await backfillGuestProfilesFromTravelers()

    expect(result.hasMore).toBe(true)
    expect(result.completed).toBe(GUEST_BACKFILL_PAGE * GUEST_BACKFILL_MAX_PAGES)
    expect(mocks.listGuestsPendingProfileBackfillRpc).toHaveBeenNthCalledWith(
      2,
      id(GUEST_BACKFILL_PAGE),
      GUEST_BACKFILL_PAGE,
    )
  })
})
