import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBooking } from './bookings.service'
import { createBookingSchema } from '@/features/reservas/schemas'

const mocks = vi.hoisted(() => ({
  createBookingRpc: vi.fn(),
  ensureTravelerGuestRpc: vi.fn(),
  getBookableRoomBySlug: vi.fn(),
  getCurrentUser: vi.fn(),
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/features/acomodacoes/services/access', () => ({ requireCapability: vi.fn() }))
vi.mock('@/repositories/rooms.repository', () => ({
  getBookableRoomBySlug: mocks.getBookableRoomBySlug,
}))
vi.mock('@/repositories/guests.repository', () => ({
  ensureTravelerGuestRpc: mocks.ensureTravelerGuestRpc,
  upsertGuestRpc: vi.fn(),
}))
vi.mock('@/repositories/bookings.repository', () => ({
  createBookingRpc: mocks.createBookingRpc,
  getBookingByGuest: vi.fn(),
  getBookingNotificationContextRpc: vi.fn().mockResolvedValue(null),
  listBookingsByGuest: vi.fn(),
  setBookingStatusRpc: vi.fn(),
}))
vi.mock('@/lib/email/mailer', () => ({ sendEmail: vi.fn() }))

const input = {
  pousadaSlug: 'pousada-teste',
  checkin: '2099-10-05',
  checkout: '2099-10-07',
  guests: 2,
}

describe('createBooking (reserva pelo site)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      name: 'Viajante Teste',
      email: 'viajante@example.test',
    })
    mocks.getBookableRoomBySlug.mockResolvedValue({
      pousadaId: 'pousada-1',
      roomId: 'room-1',
      name: 'Duplo',
      description: '',
      nightly: 200,
      capacity: 2,
    })
    mocks.ensureTravelerGuestRpc.mockResolvedValue({ id: 'guest-1' })
    mocks.createBookingRpc.mockResolvedValue({ id: 'booking-1', code: 'RP-TESTE' })
  })

  it('marca a reserva de quem veio pelo link da bio', async () => {
    await createBooking({ ...input, origin: 'link_bio' })
    expect(mocks.createBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'link_bio' }),
    )
  })

  it('sem origem informada, grava a origem padrão do site', async () => {
    await createBooking(input)
    expect(mocks.createBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'rota_das_pousadas' }),
    )
  })
})

describe('createBookingSchema — origem', () => {
  it('aceita só as origens do site', () => {
    const future = { pousadaSlug: 'x', checkin: '2099-10-05', checkout: '2099-10-07', guests: 2 }
    expect(createBookingSchema.safeParse({ ...future, origin: 'link_bio' }).success).toBe(true)
    expect(createBookingSchema.safeParse({ ...future, origin: 'balcao' }).success).toBe(false)
  })
})
