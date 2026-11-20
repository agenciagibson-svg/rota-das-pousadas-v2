// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { OwnerReservation } from '../types'

vi.mock('./owner-reservation-actions', () => ({ OwnerReservationActions: () => null }))

import { OwnerReservationsTable } from './owner-reservations-table'

afterEach(cleanup)

// Dados sintéticos.
const base: OwnerReservation = {
  id: 'b-1',
  code: 'RP-T1',
  guestName: 'Hóspede Sintético',
  guestEmail: 'hospede@exemplo.test',
  contactReleased: true,
  channel: null,
  guestPhone: '(35) 99999-0000',
  roomName: 'Chalé',
  checkin: '2099-05-10',
  checkout: '2099-05-12',
  nights: 2,
  guests: 2,
  subtotal: 800,
  fee: 0,
  total: 800,
  balanceDue: 800,
  status: 'pending',
  origin: 'rota_das_pousadas',
  paymentDueAt: null,
  createdAt: '2099-05-01T10:00:00-03:00',
  needsAttention: false,
  precheckinDone: false,
}

describe('contato do hóspede na lista de reservas (0105)', () => {
  it('pagamento não confirmado: mostra o aviso e nenhum link de e-mail', () => {
    render(
      <OwnerReservationsTable
        todayISO="2099-05-01"
        reservations={[{ ...base, contactReleased: false, guestEmail: '', guestPhone: null }]}
      />,
    )
    expect(screen.getByText('Contato liberado após o pagamento')).toBeTruthy()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('pagamento confirmado: e-mail com link', () => {
    render(
      <OwnerReservationsTable
        todayISO="2099-05-01"
        reservations={[{ ...base, status: 'confirmed', balanceDue: 0 }]}
      />,
    )
    expect(screen.queryByText('Contato liberado após o pagamento')).toBeNull()
    expect(document.querySelector('a[href="mailto:hospede@exemplo.test"]')).toBeTruthy()
  })
})
