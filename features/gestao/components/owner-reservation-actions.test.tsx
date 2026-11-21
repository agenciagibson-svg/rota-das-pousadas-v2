// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({
  updateReservationStatusAction: vi.fn(),
  expireOwnerPendingBookingAction: vi.fn(),
}))
vi.mock('@/components/dashboard/role-context', () => ({ useDashboardRole: () => 'proprietario' }))

import { OwnerReservationActions } from './owner-reservation-actions'
import { updateReservationStatusAction } from '../actions'

function openCheckout(props: { balanceDue?: number; consumptionDue?: number }) {
  render(
    <OwnerReservationActions
      bookingId="b-1"
      currentStatus="checked_in"
      guestName="Lais"
      {...props}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Check-out/ }))
}

describe('confirmação do check-out', () => {
  afterEach(cleanup)

  it('consumo em aberto aparece e não diz que está quitada', () => {
    openCheckout({ balanceDue: 0, consumptionDue: 18 })
    expect(screen.getByText(/Consumo em aberto/)).toBeTruthy()
    expect(screen.queryByText('A reserva está quitada.')).toBeNull()
  })

  it('diária e consumo pagos: quitada', () => {
    openCheckout({ balanceDue: 0, consumptionDue: 0 })
    expect(screen.getByText('A reserva está quitada.')).toBeTruthy()
  })

  it('sem o consumo carregado (Hoje, lista): não afirma que está quitada', () => {
    openCheckout({ balanceDue: 0 })
    expect(screen.queryByText('A reserva está quitada.')).toBeNull()
    expect(screen.getByText(/Confira a conta de consumo/)).toBeTruthy()
  })

  it('diária em aberto continua avisando', () => {
    openCheckout({ balanceDue: 100 })
    expect(screen.getByText(/da diária/)).toBeTruthy()
  })
  it('consumo em aberto: só fecha com motivo, que vai junto para o sistema', () => {
    vi.mocked(updateReservationStatusAction).mockResolvedValue({
      ok: true,
      data: { bookingId: 'b-1', status: 'checked_out' },
    })
    openCheckout({ balanceDue: 0, consumptionDue: 18 })
    const close = screen.getByRole('button', { name: /Fechar com pendência/ })
    expect((close as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText(/Pix amanhã/), {
      target: { value: 'Paga por Pix amanhã' },
    })
    expect((close as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(close)
    expect(updateReservationStatusAction).toHaveBeenCalledWith({
      bookingId: 'b-1',
      status: 'checked_out',
      reason: 'Paga por Pix amanhã',
    })
  })

  it('sem consumo em aberto: check-out direto, sem motivo', () => {
    vi.mocked(updateReservationStatusAction).mockResolvedValue({
      ok: true,
      data: { bookingId: 'b-1', status: 'checked_out' },
    })
    openCheckout({ balanceDue: 0, consumptionDue: 0 })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar check-out/ }))
    expect(updateReservationStatusAction).toHaveBeenLastCalledWith({
      bookingId: 'b-1',
      status: 'checked_out',
    })
  })
})
