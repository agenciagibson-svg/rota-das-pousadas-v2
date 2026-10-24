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
})
