// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OwnerReservationActions } from './owner-reservation-actions'

const mocks = vi.hoisted(() => ({ updateStatus: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/features/gestao/actions', () => ({
  updateReservationStatusAction: mocks.updateStatus,
  expireOwnerPendingBookingAction: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('check-out com saldo em aberto', () => {
  it('avisa o saldo antes de concluir e só faz o check-out quando confirmado', async () => {
    mocks.updateStatus.mockResolvedValue({ ok: true })
    render(
      <OwnerReservationActions bookingId="b-1" currentStatus="checked_in" balanceDue={411.5} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /check-out/i }))
    expect(screen.getByText('Check-out com saldo em aberto')).toBeTruthy()
    expect(screen.getByText(/R\$ 411,50 a receber/)).toBeTruthy()
    expect(mocks.updateStatus).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Fazer check-out' }))
    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith({ bookingId: 'b-1', status: 'checked_out' }),
    )
  })

  it('sem saldo, faz o check-out direto', async () => {
    mocks.updateStatus.mockResolvedValue({ ok: true })
    render(<OwnerReservationActions bookingId="b-1" currentStatus="checked_in" balanceDue={0} />)

    fireEvent.click(screen.getByRole('button', { name: /check-out/i }))
    expect(screen.queryByText('Check-out com saldo em aberto')).toBeNull()
    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith({ bookingId: 'b-1', status: 'checked_out' }),
    )
  })
})
