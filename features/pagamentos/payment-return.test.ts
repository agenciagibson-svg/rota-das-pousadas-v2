import { describe, expect, it } from 'vitest'
import { parseMpReturnStatus, paymentReturnVariant } from './payment-return'

describe('retorno do Mercado Pago', () => {
  it('lê só status conhecidos', () => {
    expect(parseMpReturnStatus('approved')).toBe('approved')
    expect(parseMpReturnStatus('in_process')).toBe('in_process')
    expect(parseMpReturnStatus('null')).toBeNull()
    expect(parseMpReturnStatus('<script>')).toBeNull()
    expect(parseMpReturnStatus(undefined)).toBeNull()
  })
  it('reserva confirmada vence qualquer status da URL', () => {
    expect(paymentReturnVariant({ status: 'confirmed' }, 'rejected')).toBe('confirmed')
  })
  it('aprovado mas ainda pendente = confirmando', () => {
    expect(paymentReturnVariant({ status: 'pending' }, 'approved')).toBe('confirming')
  })
  it('em análise e falha', () => {
    expect(paymentReturnVariant({ status: 'pending' }, 'in_process')).toBe('analysis')
    expect(paymentReturnVariant({ status: 'pending' }, 'rejected')).toBe('failed')
    expect(paymentReturnVariant({ status: 'pending' }, null)).toBe('failed')
  })
})
