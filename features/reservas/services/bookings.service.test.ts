import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBooking } from './bookings.service'
import { createBookingSchema } from '@/features/reservas/schemas'

const mocks = vi.hoisted(() => ({
  createBookingRpc: vi.fn(),
  ensureTravelerGuestRpc: vi.fn(),
  getBookableRoomBySlug: vi.fn(),
  getCurrentUser: vi.fn(),
  getMyProfile: vi.fn(),
  createBookingWithCouponRpc: vi.fn(),
}))
vi.mock('@/features/auth/services/profile.service', () => ({ getMyProfile: mocks.getMyProfile }))
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
vi.mock('@/repositories/coupons.repository', () => ({
  createBookingWithCouponRpc: mocks.createBookingWithCouponRpc,
}))

const input = {
  pousadaSlug: 'pousada-teste',
  checkin: '2099-10-05',
  checkout: '2099-10-07',
  guests: 2,
}

describe('createBooking (reserva pelo site)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMyProfile.mockResolvedValue({ missing: [] })
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

describe('createBooking exige cadastro completo (0073)', () => {
  it('recusa quando falta dado da ficha de hospedagem', async () => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'ana@ex.com',
      name: 'Ana Souza',
      memberships: [],
      platformRole: null,
    })
    mocks.getBookableRoomBySlug.mockResolvedValue({
      pousadaId: 'p1',
      roomId: 'r1',
      nightly: 500,
      capacity: 4,
    })
    mocks.getMyProfile.mockResolvedValue({ missing: ['CPF', 'celular'] })
    await expect(createBooking(createBookingSchema.parse(input))).rejects.toThrow(
      /Complete seu cadastro.*CPF, celular/,
    )
    expect(mocks.createBookingRpc).not.toHaveBeenCalled()
  })
})

describe('createBooking com cupom (0100)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMyProfile.mockResolvedValue({ missing: [] })
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      name: 'Viajante Teste',
      email: 'viajante@example.test',
    })
    mocks.getBookableRoomBySlug.mockResolvedValue({
      pousadaId: 'pousada-1',
      roomId: 'room-1',
      nightly: 500,
      capacity: 2,
      stayTotal: 1000,
      minNights: 1,
    })
    mocks.ensureTravelerGuestRpc.mockResolvedValue({ id: 'guest-1' })
  })

  it('cria pela RPC do cupom, com o subtotal do banco e o desconto que a tela mostrou', async () => {
    mocks.createBookingWithCouponRpc.mockResolvedValue({
      ok: true,
      id: 'booking-9',
      code: 'RP-CUPOM1',
      discount: 100,
      total: 900,
    })
    const result = await createBooking(
      createBookingSchema.parse({
        ...input,
        expectedTotal: 1000,
        couponCode: ' direto10 ',
        expectedDiscount: 100,
        origin: 'link_bio',
      }),
    )
    expect(result).toEqual({ id: 'booking-9', code: 'RP-CUPOM1' })
    expect(mocks.createBookingRpc).not.toHaveBeenCalled()
    expect(mocks.createBookingWithCouponRpc).toHaveBeenCalledWith({
      pousadaId: 'pousada-1',
      roomId: 'room-1',
      responsibleGuestId: 'guest-1',
      checkin: input.checkin,
      checkout: input.checkout,
      adults: 2,
      subtotal: 1000,
      couponCode: 'DIRETO10',
      origin: 'link_bio',
      expectedDiscount: 100,
    })
  })

  it('cupom recusado pelo banco vira mensagem e nenhuma reserva é criada', async () => {
    mocks.createBookingWithCouponRpc.mockResolvedValue({ ok: false, reason: 'invalid' })
    await expect(
      createBooking(createBookingSchema.parse({ ...input, couponCode: 'ESGOTADO' })),
    ).rejects.toThrow('Cupom inválido ou indisponível.')
    expect(mocks.createBookingRpc).not.toHaveBeenCalled()
  })

  it('desconto diferente do mostrado: avisa o valor novo', async () => {
    mocks.createBookingWithCouponRpc.mockResolvedValue({
      ok: false,
      reason: 'changed',
      discount: 60,
    })
    await expect(
      createBooking(
        createBookingSchema.parse({ ...input, couponCode: 'DIRETO10', expectedDiscount: 100 }),
      ),
    ).rejects.toThrow(/R\$ 60/)
  })

  it('sem cupom, segue pela create_booking com desconto zero', async () => {
    mocks.createBookingRpc.mockResolvedValue({ id: 'booking-1', code: 'RP-TESTE' })
    await createBooking(createBookingSchema.parse({ ...input, couponCode: '' }))
    expect(mocks.createBookingWithCouponRpc).not.toHaveBeenCalled()
    expect(mocks.createBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 0, subtotal: 1000, total: 1000 }),
    )
  })

  it('o schema não aceita cupom fora do formato', () => {
    expect(createBookingSchema.safeParse({ ...input, couponCode: 'a b' }).success).toBe(false)
  })
})
