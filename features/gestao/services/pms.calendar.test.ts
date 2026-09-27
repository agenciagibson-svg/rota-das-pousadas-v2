import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  role: 'proprietario' as string | null,
  rooms: [
    { id: 'r1', name: 'Chalé 1' },
    { id: 'r2', name: 'Chalé 2' },
    { id: 'r3', name: 'Suíte' },
  ],
  bookings: [] as { roomId: string; checkin: string; checkout: string }[],
  blocks: [] as { roomId: string; date: string }[],
  blockDate: vi.fn(),
  unblockDate: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: async () => 'p1',
  getActiveTenantRole: async () => m.role,
}))
vi.mock('@/features/auth/services/auth.service', () => ({
  getCurrentUser: async () => ({ id: 'u1' }),
}))
vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn() }))
vi.mock('@/repositories/pix.repository', () => ({
  listBookingIdsWithOpenProof: async () => new Set(),
}))
vi.mock('@/repositories/bookings.repository', () => ({ expirePendingBookingRpc: vi.fn() }))
vi.mock('@/repositories/reviews.repository', () => ({
  listReviewsByPousada: vi.fn(),
  updateReviewResponseByPousada: vi.fn(),
}))
vi.mock('@/repositories/management.repository', () => ({
  getManagedPousada: async () => ({
    id: 'p1',
    slug: 'p',
    name: 'P',
    status: 'publicada',
    roomId: 'r1',
    timezone: 'America/Sao_Paulo',
  }),
  getPousadaSettings: vi.fn(),
  listReservationsByPousada: vi.fn(),
  listActiveRoomsByPousada: async () => m.rooms,
  listBookingRanges: async () => m.bookings,
  listBlockedDaysByPousada: async () => m.blocks,
  blockDate: m.blockDate,
  unblockDate: m.unblockDate,
  updatePousadaSettings: vi.fn(),
  updateReservationStatusByPousada: vi.fn(),
}))

import { blockOwnerDate, unblockOwnerDate } from './pms.service'

beforeEach(() => {
  m.role = 'proprietario'
  m.bookings = []
  m.blocks = []
  m.blockDate.mockReset()
  m.unblockDate.mockReset()
})

describe('calendário por quarto', () => {
  it('"todos os quartos" bloqueia só os que estão livres naquele dia', async () => {
    m.bookings = [{ roomId: 'r1', checkin: '2026-10-10', checkout: '2026-10-12' }]
    m.blocks = [{ roomId: 'r2', date: '2026-10-10' }]
    const res = await blockOwnerDate('2026-10-10')
    expect(res.affected).toBe(1)
    expect(m.blockDate).toHaveBeenCalledTimes(1)
    expect(m.blockDate).toHaveBeenCalledWith('p1', 'r3', '2026-10-10')
  })
  it('quarto específico: bloqueia só ele', async () => {
    await blockOwnerDate('2026-10-20', 'r2')
    expect(m.blockDate).toHaveBeenCalledWith('p1', 'r2', '2026-10-20')
    expect(m.blockDate).toHaveBeenCalledTimes(1)
  })
  it('recusa quarto de outra pousada e dia sem quarto livre', async () => {
    await expect(blockOwnerDate('2026-10-20', 'x9')).rejects.toThrow('Quarto não encontrado')
    m.blocks = m.rooms.map((r) => ({ roomId: r.id, date: '2026-10-21' }))
    await expect(blockOwnerDate('2026-10-21')).rejects.toThrow('Nenhum quarto livre')
  })
  it('recepção não bloqueia (só consulta)', async () => {
    m.role = 'recepcionista'
    await expect(blockOwnerDate('2026-10-20')).rejects.toThrow('permissão')
    expect(m.blockDate).not.toHaveBeenCalled()
  })
  it('liberar avisa quando há bloqueio de vários dias', async () => {
    m.blocks = [
      { roomId: 'r1', date: '2026-10-22' },
      { roomId: 'r2', date: '2026-10-22' },
    ]
    m.unblockDate.mockImplementation(async (_p: string, roomId: string) => {
      if (roomId === 'r2') throw new Error('bloqueio maior')
    })
    await expect(unblockOwnerDate('2026-10-22')).rejects.toThrow(/Liberado em 1 quarto.*Chalé 2/)
  })
})
