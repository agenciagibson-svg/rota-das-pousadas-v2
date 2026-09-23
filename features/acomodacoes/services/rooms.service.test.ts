import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setOperationalStatus } from './rooms.service'

const mocks = vi.hoisted(() => ({
  getRoomById: vi.fn(),
  updateRoomOperationalStatus: vi.fn(),
}))

vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: async () => 'pousada-1',
  getActiveTenantRole: async () => 'governanca',
}))
vi.mock('@/repositories/rooms.repository', () => ({
  listRoomsByPousada: vi.fn(),
  listRoomsForHousekeeping: vi.fn(),
  getRoomById: mocks.getRoomById,
  insertRoom: vi.fn(),
  updateRoom: vi.fn(),
  setRoomStatus: vi.fn(),
  setRoomAmenities: vi.fn(),
  updateRoomOperationalStatus: mocks.updateRoomOperationalStatus,
}))

describe('setOperationalStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Como na RLS de `rooms` (rooms_read): a Governança não lê a tabela direto.
    mocks.getRoomById.mockResolvedValue(null)
    mocks.updateRoomOperationalStatus.mockResolvedValue(undefined)
  })

  it('governança muda o status pela RPC, sem depender de ler rooms direto', async () => {
    await expect(setOperationalStatus('room-1', 'cleaning')).resolves.toBeUndefined()
    expect(mocks.updateRoomOperationalStatus).toHaveBeenCalledWith(
      'pousada-1',
      'room-1',
      'cleaning',
    )
  })
})
