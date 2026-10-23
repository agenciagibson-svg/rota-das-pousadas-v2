import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitMyPrecheckin } from './precheckin.service'
import type { PrecheckinInput, PrecheckinSnapshot } from '../precheckin'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMyPrecheckinRpc: vi.fn(),
  submitPrecheckinRpc: vi.fn(),
  lookupCep: vi.fn(),
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/precheckin.repository', () => ({
  getMyPrecheckinRpc: mocks.getMyPrecheckinRpc,
  submitPrecheckinRpc: mocks.submitPrecheckinRpc,
}))
vi.mock('@/lib/cep', () => ({ lookupCep: mocks.lookupCep }))

const BOOKING = '30000000-0000-4000-8000-000000000881'
const KEPT = '88000000-0000-4000-8000-000000000002'
const KID = '88000000-0000-4000-8000-000000000005'

const snapshot = {
  bookingId: BOOKING,
  canSubmit: true,
  maxCompanions: 2,
  maxInfants: 2,
  companions: [
    {
      id: KEPT,
      fullName: 'Ana',
      guestType: 'adult',
      birthDate: '1990-01-01',
      documentType: 'RG',
      hasDocument: true,
    },
    {
      id: KID,
      fullName: 'Bia',
      guestType: 'child',
      birthDate: null,
      documentType: null,
      hasDocument: false,
    },
  ],
} as unknown as PrecheckinSnapshot

const input: PrecheckinInput = {
  bookingId: BOOKING,
  phone: ' (34) 91234-5678 ',
  birthDate: '1985-04-10',
  nationality: 'brasileira',
  documentNumber: '529.982.247-25',
  hasStoredDocument: false,
  country: 'BR',
  cep: '38400-000',
  address: 'Rua das Flores, 100',
  city: 'Uberlândia',
  state: 'mg',
  companions: [
    {
      keepDocumentOf: KEPT,
      previousId: KEPT,
      fullName: 'Ana',
      guestType: 'adult',
      birthDate: '1990-01-01',
      documentType: '',
      documentNumber: '',
    },
    {
      keepDocumentOf: '',
      previousId: KID,
      fullName: 'Bia',
      guestType: 'child',
      birthDate: '',
      documentType: 'CPF',
      documentNumber: '111.444.777-35',
    },
  ],
  expectedArrivalTime: '',
}

describe('submitMyPrecheckin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYMENT_TOKENS_ENCRYPTION_KEY = 'chave-de-teste-precheckin'
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getMyPrecheckinRpc.mockResolvedValue(snapshot)
    mocks.lookupCep.mockResolvedValue({ city: 'Uberlândia', state: 'MG' })
  })

  it('cifra os documentos e nunca manda documento em claro ao banco', async () => {
    await submitMyPrecheckin(input)
    const sent = mocks.submitPrecheckinRpc.mock.calls[0]![0]
    const json = JSON.stringify(sent)
    expect(json).not.toContain('529.982.247-25')
    expect(json).not.toContain('52998224725')
    expect(json).not.toContain('111.444.777-35')
    expect(sent.document.type).toBe('CPF')
    expect(sent.document.encrypted).toMatch(/^[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:/)
    expect(sent.document.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(sent.document.last4).toBe('4725')
    expect(sent.companions[0]).toMatchObject({ keepDocumentOf: KEPT, documentNumber: null })
    expect(sent.companions[1].documentNumber).toMatch(/^[A-Za-z0-9+/]{16}:/)
    expect(sent).toMatchObject({
      phone: '(34) 91234-5678',
      state: 'MG',
      country: 'BR',
      nationality: 'Brasileira',
      expectedArrivalTime: null,
    })
  })

  it('documento em branco mantém o salvo', async () => {
    await submitMyPrecheckin({ ...input, documentNumber: '', hasStoredDocument: true })
    expect(mocks.submitPrecheckinRpc.mock.calls[0]![0].document).toBeNull()
  })

  it('não aponta para documento que não é desta reserva', async () => {
    await submitMyPrecheckin({
      ...input,
      companions: [
        { ...input.companions[0]!, keepDocumentOf: '99999999-0000-4000-8000-000000000001' },
      ],
    })
    expect(mocks.submitPrecheckinRpc.mock.calls[0]![0].companions[0].keepDocumentOf).toBeNull()
  })

  it('acompanhante antigo sem documento leva o previousId (anotações da equipe ficam)', async () => {
    await submitMyPrecheckin(input)
    const sent = mocks.submitPrecheckinRpc.mock.calls[0]![0]
    expect(sent.companions[0]).toMatchObject({ keepDocumentOf: KEPT, previousId: KEPT })
    expect(sent.companions[1]).toMatchObject({ keepDocumentOf: null, previousId: KID })
  })

  it('previousId de fora da reserva vira nulo', async () => {
    await submitMyPrecheckin({
      ...input,
      companions: [{ ...input.companions[1]!, previousId: '99999999-0000-4000-8000-000000000001' }],
    })
    expect(mocks.submitPrecheckinRpc.mock.calls[0]![0].companions[0].previousId).toBeNull()
  })

  it('reserva alheia, fechada, acima do limite ou CEP de outra UF: recusa sem gravar', async () => {
    mocks.getMyPrecheckinRpc.mockResolvedValueOnce(null)
    await expect(submitMyPrecheckin(input)).rejects.toThrow('Reserva não encontrada.')
    mocks.getMyPrecheckinRpc.mockResolvedValueOnce({ ...snapshot, canSubmit: false })
    await expect(submitMyPrecheckin(input)).rejects.toThrow(/antes do check-in/)
    mocks.getMyPrecheckinRpc.mockResolvedValueOnce({ ...snapshot, maxCompanions: 1 })
    await expect(submitMyPrecheckin(input)).rejects.toThrow(/mais 1 pessoa/)
    mocks.lookupCep.mockResolvedValueOnce({ city: 'São Paulo', state: 'SP' })
    await expect(submitMyPrecheckin(input)).rejects.toThrow(/Confira a UF/)
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    await expect(submitMyPrecheckin(input)).rejects.toThrow(/login/)
    expect(mocks.submitPrecheckinRpc).not.toHaveBeenCalled()
  })
})
