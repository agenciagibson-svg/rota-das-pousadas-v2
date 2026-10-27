import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  role: 'recepcionista' as string | null,
  bookingPousada: 'p1' as string | null,
  timezone: 'America/Sao_Paulo',
  listRooms: vi.fn(),
  listBookings: vi.fn(),
  listHolds: vi.fn(),
  moveRpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: async () => 'p1',
  getActiveTenantRole: async () => m.role,
}))
vi.mock('@/repositories/management.repository', () => ({
  getManagedPousada: async () => ({
    id: 'p1',
    slug: 'p',
    name: 'P',
    status: 'publicada',
    roomId: 'r1',
    timezone: m.timezone,
  }),
}))
vi.mock('@/repositories/bookings.repository', () => ({
  getBookingPousadaId: async () => m.bookingPousada,
}))
vi.mock('@/repositories/occupancy.repository', () => ({
  listOccupancyRooms: m.listRooms,
  listOccupancyBookings: m.listBookings,
  listOccupancyHolds: m.listHolds,
  moveBookingRpc: m.moveRpc,
}))

import { getOccupancyBoard, moveOwnerBooking } from './occupancy.service'

const input = {
  bookingId: '00000000-0000-4000-8000-000000000001',
  version: 3,
  roomId: '00000000-0000-4000-8000-0000000000aa',
  checkin: '2026-11-10',
  checkout: '2026-11-12',
  reprice: false,
}

beforeEach(() => {
  m.role = 'recepcionista'
  m.bookingPousada = 'p1'
  m.timezone = 'America/Sao_Paulo'
  for (const fn of [m.listRooms, m.listBookings, m.listHolds, m.moveRpc]) fn.mockReset()
  m.listRooms.mockResolvedValue([])
  m.listBookings.mockResolvedValue([])
  m.listHolds.mockResolvedValue([])
  m.moveRpc.mockResolvedValue({ id: input.bookingId, version: 4, total: 550, previousTotal: 550 })
  vi.useRealTimers()
})

describe('getOccupancyBoard', () => {
  it('janela no fuso da pousada: 21h de Brasília ainda é o mesmo dia', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T00:30:00Z')) // 26/10 21:30 em Brasília
    const board = await getOccupancyBoard({})
    expect(board.today).toBe('2026-10-26')
    expect(board.from).toBe('2026-10-25')
    expect(board.days).toBe(14)
    expect(m.listBookings).toHaveBeenCalledWith('p1', '2026-10-25', '2026-11-08')
    expect(m.listHolds).toHaveBeenCalledWith('p1', '2026-10-25', '2026-11-08')
  })

  it('respeita início e 30 dias da URL', async () => {
    const board = await getOccupancyBoard({
      inicio: new Date().toISOString().slice(0, 10),
      dias: '30',
    })
    expect(board.days).toBe(30)
    expect(m.listBookings).toHaveBeenCalledWith(
      'p1',
      board.from,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )
  })

  it('financeiro e governança não abrem o mapa', async () => {
    for (const role of ['financeiro_pousada', 'governanca', null]) {
      m.role = role
      await expect(getOccupancyBoard({})).rejects.toThrow('Você não tem permissão para esta ação.')
    }
    expect(m.listBookings).not.toHaveBeenCalled()
  })
})

describe('moveOwnerBooking', () => {
  it('recepção move reserva da pousada ativa e nunca manda valor', async () => {
    await moveOwnerBooking(input)
    expect(m.moveRpc).toHaveBeenCalledWith({
      bookingId: input.bookingId,
      version: 3,
      roomId: input.roomId,
      checkin: '2026-11-10',
      checkout: '2026-11-12',
      reprice: false,
    })
  })

  it('repassa o pedido de usar as tarifas', async () => {
    await moveOwnerBooking({ ...input, reprice: true })
    expect(m.moveRpc).toHaveBeenCalledWith(expect.objectContaining({ reprice: true }))
  })

  it('reserva de outra pousada (ou invisível) é recusada antes da RPC', async () => {
    m.bookingPousada = 'p2'
    await expect(moveOwnerBooking(input)).rejects.toThrow('Reserva não encontrada nesta pousada.')
    m.bookingPousada = null
    await expect(moveOwnerBooking(input)).rejects.toThrow('Reserva não encontrada nesta pousada.')
    expect(m.moveRpc).not.toHaveBeenCalled()
  })

  it('papel sem booking:manage é recusado', async () => {
    m.role = 'financeiro_pousada'
    await expect(moveOwnerBooking(input)).rejects.toThrow('Você não tem permissão para esta ação.')
    expect(m.moveRpc).not.toHaveBeenCalled()
  })
})
