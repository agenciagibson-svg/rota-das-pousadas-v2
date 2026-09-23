import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryAvailability } from './availability.repository'

const mocks = vi.hoisted(() => ({ from: vi.fn(), blocks: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ from: mocks.from }),
}))
vi.mock('@/repositories/room-blocks.repository', () => ({
  listActiveBlocksOverlapping: mocks.blocks,
}))

const query = {
  pousadaId: 'pousada-1',
  checkin: '2026-10-01',
  checkout: '2026-10-03',
  adults: 2,
  children: 0,
  pets: false,
}
const room = {
  id: 'room-1',
  name: 'Quarto',
  capacity_max: 2,
  capacity: 2,
  pets_allowed: false,
  status: 'active',
  operational_status: 'available',
  category_id: null,
  accommodation_categories: null,
}

function setup(
  rooms: unknown[],
  bookings: unknown[],
  error: Error | null = null,
  channelEvents: unknown[] = [],
  channelError: Error | null = null,
) {
  const roomsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rooms, error: null }).then(resolve),
  }
  const bookingsQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockResolvedValue({ data: bookings, error }),
  }
  const channelEventsQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockResolvedValue({ data: channelEvents, error: channelError }),
  }
  const byTable: Record<string, unknown> = {
    rooms: roomsQuery,
    bookings: bookingsQuery,
    channel_events: channelEventsQuery,
  }
  mocks.from.mockImplementation((table: string) => byTable[table])
  mocks.blocks.mockResolvedValue([])
  return { bookingsQuery, channelEventsQuery }
}

describe('queryAvailability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('propaga falhas de leitura das reservas em vez de anunciar disponibilidade', async () => {
    const error = new Error('Falha ao consultar reservas')
    setup([room], [], error)
    await expect(queryAvailability(query)).rejects.toThrow(error)
  })

  it('considera reservas conflitantes retornadas pelo banco', async () => {
    const { bookingsQuery } = setup([room], [{ room_id: room.id }])
    const result = await queryAvailability(query)
    expect(result[0].available).toBe(false)
    expect(result[0].reasons).toContain('booking_conflict')
    expect(bookingsQuery.in).toHaveBeenCalledWith('status', ['pending', 'confirmed', 'checked_in'])
  })

  it('considera noites já vendidas no Airbnb/Booking (iCal importado)', async () => {
    const { channelEventsQuery } = setup([room], [], null, [{ room_id: room.id }])
    const result = await queryAvailability(query)
    expect(result[0].available).toBe(false)
    expect(result[0].reasons).toContain('channel_conflict')
    expect(channelEventsQuery.lt).toHaveBeenCalledWith('starts_on', query.checkout)
    expect(channelEventsQuery.gt).toHaveBeenCalledWith('ends_on', query.checkin)
  })

  it('propaga falha de leitura dos canais em vez de anunciar disponibilidade', async () => {
    const error = new Error('Falha ao consultar canais')
    setup([room], [], null, [], error)
    await expect(queryAvailability(query)).rejects.toThrow(error)
  })

  it('não consulta reservas nem canais quando não há quartos', async () => {
    setup([], [])
    await expect(queryAvailability(query)).resolves.toEqual([])
    expect(mocks.from).not.toHaveBeenCalledWith('bookings')
    expect(mocks.from).not.toHaveBeenCalledWith('channel_events')
  })
})
