import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveGuest } from './guests.service'

const mocks = vi.hoisted(() => ({ upsertGuestRpc: vi.fn() }))

vi.mock('@/features/auth/services/auth.service', () => ({
  getCurrentUser: async () => ({
    id: 'user-1',
    email: 'dono@example.test',
    name: 'Dono',
    platformRole: null,
    memberships: [],
  }),
}))
vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: async () => 'pousada-1',
  getActiveTenantRole: async () => 'proprietario',
}))
vi.mock('@/repositories/guests.repository', () => ({
  listGuestsByPousada: vi.fn(),
  getGuestById: vi.fn(),
  upsertGuestRpc: mocks.upsertGuestRpc,
}))

const INPUT: Parameters<typeof saveGuest>[0] = {
  guestId: '40000000-0000-0000-0000-000000000010',
  fullName: 'Maria Aparecida da Silva',
  preferredName: '',
  email: '',
  phone: '',
  whatsapp: '',
  documentType: '',
  documentNumber: '',
  birthDate: '',
  nationality: '',
  country: 'BR',
  city: '',
  state: '',
  address: '',
  cep: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  preferences: [],
  dietaryRestrictions: '',
  accessibilityNeeds: '',
  internalNotes: '',
  marketingConsent: false,
}

describe('saveGuest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upsertGuestRpc.mockResolvedValue({ id: INPUT.guestId })
  })

  it('manda nascimento vazio como nulo — a coluna é date e "" derruba a RPC', async () => {
    await saveGuest(INPUT)
    expect(mocks.upsertGuestRpc).toHaveBeenCalledWith(expect.objectContaining({ birthDate: null }))
  })

  it('mantém o nascimento informado', async () => {
    await saveGuest({ ...INPUT, birthDate: '1980-05-20' })
    expect(mocks.upsertGuestRpc).toHaveBeenCalledWith(
      expect.objectContaining({ birthDate: '1980-05-20' }),
    )
  })
})
