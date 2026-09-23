// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BookingFolioCard } from './booking-folio'
import type { BookingFolio } from '../../folio'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/features/reservas/actions', () => ({
  addBookingChargeAction: vi.fn(),
  cancelBookingChargeAction: vi.fn(),
  registerManualPaymentAction: vi.fn(),
  reverseManualPaymentAction: vi.fn(),
}))

afterEach(cleanup)

const folio: BookingFolio = {
  charges: [
    {
      id: 'c-1',
      description: 'Água mineral',
      quantity: 2,
      unitPrice: 5.5,
      amount: 11,
      createdAt: '2026-09-23T22:00:00+00:00',
      cancelledAt: null,
      cancellationReason: null,
    },
  ],
  payments: [
    {
      id: 'p-1',
      source: 'mercadopago',
      method: 'pix',
      amount: 100,
      status: 'aprovado',
      createdAt: '2026-09-20T12:00:00+00:00',
      notes: '',
      reversedAt: null,
      reversalReason: null,
    },
    {
      id: 'p-2',
      source: 'manual',
      method: 'dinheiro',
      amount: 500,
      status: 'aprovado',
      createdAt: '2026-09-23T23:00:00+00:00',
      notes: 'Pago na saída',
      reversedAt: null,
      reversalReason: null,
    },
  ],
  canRegister: true,
  canReverse: false,
}

describe('Conta do hóspede', () => {
  it('mostra consumo, pagamentos e saldo; recepção lança mas não desfaz', () => {
    render(
      <BookingFolioCard
        bookingId="b-1"
        status="checked_in"
        balanceDue={411}
        timeZone="America/Sao_Paulo"
        folio={folio}
      />,
    )
    expect(screen.getByText('Saldo em aberto: R$ 411,00')).toBeTruthy()
    expect(screen.getByText('2 × Água mineral')).toBeTruthy()
    expect(screen.getByText('Mercado Pago · PIX')).toBeTruthy()
    // Pagamento do balcão: 23:00 UTC = 20:00 em Brasília, com a observação.
    expect(screen.getByText('23/09, 20:00 · Pago na saída')).toBeTruthy()
    expect(screen.getByRole('button', { name: /lançar consumo/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /registrar pagamento/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /cancelar água mineral/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /estornar pagamento/i })).toBeNull()
  })

  it('quem pode desfazer vê cancelar e estornar só no que é do balcão', () => {
    render(
      <BookingFolioCard
        bookingId="b-1"
        status="checked_in"
        balanceDue={411}
        timeZone="America/Sao_Paulo"
        folio={{ ...folio, canReverse: true }}
      />,
    )
    expect(screen.getByRole('button', { name: /cancelar água mineral/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /estornar pagamento/i })).toHaveLength(1)
  })

  it('reserva pendente: pagamento sim, consumo só depois de confirmar', () => {
    render(
      <BookingFolioCard
        bookingId="b-1"
        status="pending"
        balanceDue={500}
        timeZone="America/Sao_Paulo"
        folio={{ ...folio, charges: [], payments: [] }}
      />,
    )
    expect(screen.queryByRole('button', { name: /lançar consumo/i })).toBeNull()
    expect(
      screen.getByText('Consumo pode ser lançado depois que a reserva for confirmada.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /registrar pagamento/i })).toBeTruthy()
  })

  it('conta quitada não oferece novo pagamento', () => {
    render(
      <BookingFolioCard
        bookingId="b-1"
        status="checked_out"
        balanceDue={0}
        timeZone="America/Sao_Paulo"
        folio={folio}
      />,
    )
    expect(screen.getByText('Conta quitada')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /registrar pagamento/i })).toBeNull()
  })
})
