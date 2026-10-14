import { describe, expect, it } from 'vitest'
import { bookingPaymentMethodLabel, registerBookingPaymentSchema } from './booking-payment'

describe('pagamento manual da diária (0086)', () => {
  it('rotula as formas gravadas em payments.method', () => {
    expect(bookingPaymentMethodLabel('manual_dinheiro')).toBe('Dinheiro')
    expect(bookingPaymentMethodLabel('manual_transferencia')).toBe('Transferência')
    expect(bookingPaymentMethodLabel('pix_direto')).toBe('Pix (comprovante)')
    expect(bookingPaymentMethodLabel('credit_card')).toBe('Cartão (Mercado Pago)')
  })

  it('aceita valor com vírgula já convertido e recusa forma desconhecida', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    expect(
      registerBookingPaymentSchema.safeParse({
        bookingId: id,
        amount: '150.50',
        method: 'dinheiro',
      }).success,
    ).toBe(true)
    expect(
      registerBookingPaymentSchema.safeParse({ bookingId: id, amount: '0', method: 'dinheiro' })
        .success,
    ).toBe(false)
    expect(
      registerBookingPaymentSchema.safeParse({ bookingId: id, amount: '10', method: 'bitcoin' })
        .success,
    ).toBe(false)
  })
})
