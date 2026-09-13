import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckoutPreference } from './checkout.service'
const mocks = vi.hoisted(() => ({ user: vi.fn(), booking: vi.fn(), context: vi.fn(), checkout: vi.fn() }))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/repositories/bookings.repository', () => ({ getBookingForCheckout: mocks.booking }))
vi.mock('@/repositories/payments.repository', () => ({ getPousadaPaymentContextForWebhook: mocks.context }))
vi.mock('@/lib/crypto/token-cipher', () => ({ decryptToken: () => 'test-token' }))
vi.mock('./mp-client', () => ({ createCheckoutPreference: mocks.checkout }))

describe('checkout autorizado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({ id: 'traveler' })
    mocks.booking.mockResolvedValue({ id: 'booking', code: 'RP-TEST', pousadaId: 'tenant', status: 'pending', total: 1000, fee: 80, balanceDue: 399.50 })
    mocks.context.mockResolvedValue({ pousadaId: 'tenant', accessTokenEncrypted: 'ciphertext' })
    mocks.checkout.mockResolvedValue({ init_point: 'https://example.test/pay' })
  })
  it('cobra o saldo restante com comissão proporcional', async () => {
    await createCheckoutPreference('booking')
    expect(mocks.booking).toHaveBeenCalledWith('booking', 'traveler')
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 399.50, marketplaceFee: 31.96 }))
  })
  it('não acessa token quando a reserva não pertence ao usuário', async () => {
    mocks.booking.mockResolvedValue(null)
    await expect(createCheckoutPreference('other')).rejects.toThrow('Reserva não encontrada')
    expect(mocks.context).not.toHaveBeenCalled()
  })
  it('recusa contexto de outra pousada', async () => {
    mocks.context.mockResolvedValue({ pousadaId: 'other', accessTokenEncrypted: 'ciphertext' })
    await expect(createCheckoutPreference('booking')).rejects.toThrow()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})
