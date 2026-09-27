import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckoutPreference } from './checkout.service'
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  booking: vi.fn(),
  context: vi.fn(),
  checkout: vi.fn(),
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/repositories/bookings.repository', () => ({ getBookingForCheckout: mocks.booking }))
vi.mock('@/repositories/payments.repository', () => ({
  getPousadaPaymentContextForWebhook: mocks.context,
}))
vi.mock('@/lib/crypto/token-cipher', () => ({ decryptToken: () => 'test-token' }))
vi.mock('./mp-client', () => ({ createCheckoutPreference: mocks.checkout }))

describe('checkout autorizado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({ id: 'traveler' })
    mocks.booking.mockResolvedValue({
      id: 'booking',
      code: 'RP-TEST',
      pousadaId: 'tenant',
      status: 'pending',
      total: 1000,
      fee: 80,
      balanceDue: 399.5,
    })
    mocks.context.mockResolvedValue({ pousadaId: 'tenant', accessTokenEncrypted: 'ciphertext' })
    mocks.checkout.mockResolvedValue({ init_point: 'https://example.test/pay' })
  })
  it('cobra o saldo restante, sem comissão da plataforma', async () => {
    await createCheckoutPreference('booking')
    expect(mocks.booking).toHaveBeenCalledWith('booking', 'traveler')
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 399.5 }))
    expect(mocks.checkout.mock.calls[0][0]).not.toHaveProperty('marketplaceFee')
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
  it('link do Mercado Pago expira junto com o prazo da reserva (0070)', async () => {
    const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    mocks.booking.mockResolvedValue({
      id: 'booking',
      code: 'RP-TEST',
      pousadaId: 'tenant',
      status: 'pending',
      total: 1000,
      fee: 0,
      balanceDue: 1000,
      paymentDueAt: dueAt,
    })
    await createCheckoutPreference('booking')
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: dueAt }))
  })
  it('recusa pagar reserva com prazo vencido, sem tocar no token (0070)', async () => {
    const dueAt = new Date(Date.now() - 60 * 1000).toISOString()
    mocks.booking.mockResolvedValue({
      id: 'booking',
      code: 'RP-TEST',
      pousadaId: 'tenant',
      status: 'pending',
      total: 1000,
      fee: 0,
      balanceDue: 1000,
      paymentDueAt: dueAt,
    })
    await expect(createCheckoutPreference('booking')).rejects.toThrow('prazo de pagamento')
    expect(mocks.context).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})
