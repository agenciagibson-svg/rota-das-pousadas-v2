import { describe, expect, it } from 'vitest'
import {
  acceptsCharges,
  acceptsPayments,
  formatBRL,
  formatFolioDateTime,
  paymentMethodLabel,
} from './folio'
import { addChargeSchema, registerPaymentSchema, reversePaymentSchema } from './folio-schemas'

const BOOKING = '30000000-0000-4000-8000-000000000021'

describe('conta do hóspede — regras', () => {
  it('consumo só em reserva confirmada, hospedada ou encerrada; pagamento também na pendente', () => {
    expect(acceptsCharges('checked_in')).toBe(true)
    expect(acceptsCharges('pending')).toBe(false)
    expect(acceptsCharges('cancelled')).toBe(false)
    expect(acceptsPayments('pending')).toBe(true)
    expect(acceptsPayments('no_show')).toBe(false)
    expect(acceptsPayments('quote')).toBe(false)
  })

  it('rotula a forma de pagamento', () => {
    expect(paymentMethodLabel({ source: 'manual', method: 'cartao_debito' })).toBe(
      'Cartão de débito',
    )
    expect(paymentMethodLabel({ source: 'mercadopago', method: 'pix' })).toBe('Mercado Pago · PIX')
    expect(paymentMethodLabel({ source: 'mercadopago', method: 'visa' })).toBe('Mercado Pago')
  })

  it('mostra a hora do lançamento no fuso da pousada', () => {
    // 01:30 UTC do dia 24 = 22:30 do dia 23 em Brasília.
    expect(formatFolioDateTime('2026-09-24T01:30:00+00:00', 'America/Sao_Paulo')).toBe(
      '23/09, 22:30',
    )
    expect(formatFolioDateTime('2026-09-24T01:30:00+00:00', 'Brasília')).toBe('23/09, 22:30')
  })

  it('formata reais com centavos', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50')
    expect(formatBRL(11)).toBe('R$ 11,00')
  })
})

describe('conta do hóspede — formulários', () => {
  it('aceita consumo com centavos e recusa três casas decimais', () => {
    const ok = addChargeSchema.safeParse({
      bookingId: BOOKING,
      description: ' Água ',
      quantity: '2',
      unitPrice: '5.5',
    })
    expect(ok.success).toBe(true)
    if (ok.success)
      expect(ok.data).toMatchObject({ description: 'Água', quantity: 2, unitPrice: 5.5 })
    expect(
      addChargeSchema.safeParse({
        bookingId: BOOKING,
        description: 'Suco',
        quantity: 1,
        unitPrice: '7.555',
      }).success,
    ).toBe(false)
    expect(
      addChargeSchema.safeParse({
        bookingId: BOOKING,
        description: '  ',
        quantity: 1,
        unitPrice: 7,
      }).success,
    ).toBe(false)
    expect(
      addChargeSchema.safeParse({
        bookingId: BOOKING,
        description: 'Suco',
        quantity: 0,
        unitPrice: 7,
      }).success,
    ).toBe(false)
  })

  it('aceita só as formas de pagamento do balcão', () => {
    expect(
      registerPaymentSchema.safeParse({ bookingId: BOOKING, method: 'pix', amount: '150.90' })
        .success,
    ).toBe(true)
    expect(
      registerPaymentSchema.safeParse({ bookingId: BOOKING, method: 'boleto', amount: 10 }).success,
    ).toBe(false)
    expect(
      registerPaymentSchema.safeParse({ bookingId: BOOKING, method: 'dinheiro', amount: 0 })
        .success,
    ).toBe(false)
  })

  it('estorno exige motivo', () => {
    const base = { bookingId: BOOKING, paymentId: BOOKING }
    expect(reversePaymentSchema.safeParse({ ...base, reason: ' ' }).success).toBe(false)
    expect(reversePaymentSchema.safeParse({ ...base, reason: 'Lançado errado' }).success).toBe(true)
  })
})
