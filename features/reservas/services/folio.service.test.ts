import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBookingFolio, registerPayment, reversePayment } from './folio.service'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  isBookingOfPousada: vi.fn(),
  registerManualPaymentRpc: vi.fn(),
  reverseManualPaymentRpc: vi.fn(),
  notifyBookingConfirmed: vi.fn(),
}))
vi.mock('@/features/acomodacoes/services/access', () => ({
  requireCapability: mocks.requireCapability,
}))
vi.mock('@/features/pagamentos/services/booking-confirmed-email', () => ({
  notifyBookingConfirmed: mocks.notifyBookingConfirmed,
}))
vi.mock('@/repositories/folio.repository', () => ({
  addBookingChargeRpc: vi.fn(),
  cancelBookingChargeRpc: vi.fn(),
  isBookingOfPousada: mocks.isBookingOfPousada,
  listBookingCharges: vi.fn().mockResolvedValue([]),
  listBookingPayments: vi.fn().mockResolvedValue([]),
  registerManualPaymentRpc: mocks.registerManualPaymentRpc,
  reverseManualPaymentRpc: mocks.reverseManualPaymentRpc,
}))

const BOOKING = '30000000-0000-4000-8000-000000000021'

describe('conta do hóspede — serviço', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isBookingOfPousada.mockResolvedValue(true)
  })

  it('recepção lança, mas não desfaz', async () => {
    mocks.requireCapability.mockResolvedValue({ pousadaId: 'pousada-1', role: 'recepcionista' })
    const folio = await getBookingFolio(BOOKING)
    expect(folio).toMatchObject({ canRegister: true, canReverse: false })
    expect(mocks.requireCapability).toHaveBeenCalledWith('booking:manage')
  })

  it('proprietário lança e desfaz', async () => {
    mocks.requireCapability.mockResolvedValue({ pousadaId: 'pousada-1', role: 'proprietario' })
    expect(await getBookingFolio(BOOKING)).toMatchObject({ canRegister: true, canReverse: true })
  })

  it('não mostra a conta de reserva de outra pousada', async () => {
    mocks.requireCapability.mockResolvedValue({ pousadaId: 'pousada-1', role: 'proprietario' })
    mocks.isBookingOfPousada.mockResolvedValue(false)
    expect(await getBookingFolio(BOOKING)).toBeNull()
  })

  it('manda o e-mail de confirmação só quando o pagamento quita a pendente', async () => {
    mocks.requireCapability.mockResolvedValue({ pousadaId: 'pousada-1', role: 'recepcionista' })
    mocks.registerManualPaymentRpc.mockResolvedValueOnce({ confirmed: false })
    await registerPayment({ bookingId: BOOKING, method: 'pix', amount: 200 })
    expect(mocks.notifyBookingConfirmed).not.toHaveBeenCalled()
    expect(mocks.registerManualPaymentRpc).toHaveBeenCalledWith({
      bookingId: BOOKING,
      method: 'pix',
      amount: 200,
      notes: '',
    })

    mocks.registerManualPaymentRpc.mockResolvedValueOnce({ confirmed: true })
    await registerPayment({ bookingId: BOOKING, method: 'pix', amount: 300 })
    expect(mocks.notifyBookingConfirmed).toHaveBeenCalledWith(BOOKING)
  })

  it('estorno exige payment:refund', async () => {
    mocks.requireCapability.mockRejectedValue(new Error('Você não tem permissão para esta ação.'))
    await expect(
      reversePayment({ bookingId: BOOKING, paymentId: BOOKING, reason: 'Lançado errado' }),
    ).rejects.toThrow('Você não tem permissão')
    expect(mocks.requireCapability).toHaveBeenCalledWith('payment:refund')
    expect(mocks.reverseManualPaymentRpc).not.toHaveBeenCalled()
  })
})
