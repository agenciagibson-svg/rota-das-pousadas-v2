// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const actions = vi.hoisted(() => ({
  shareBookingAction: vi.fn(),
  revokeBookingShareAction: vi.fn(),
}))
vi.mock('../actions', () => actions)

import { BookingTripActions } from './booking-trip-actions'

// Dados sintéticos.
const BOOKING = '30000000-0000-4000-8000-000000000941'
const URL_1 = `https://rota.example.test/viagem/${'a'.repeat(43)}`
const URL_2 = `https://rota.example.test/viagem/${'b'.repeat(43)}`

function renderActions() {
  render(
    <BookingTripActions
      bookingId={BOOKING}
      pousadaName="Pousada Teste"
      checkin="2026-11-14"
      checkout="2026-11-17"
    />,
  )
}

describe('BookingTripActions', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('agenda aponta para a rota protegida da reserva', () => {
    renderActions()
    const link = screen.getByRole('link', { name: /Adicionar à agenda/ })
    expect(link.getAttribute('href')).toBe(`/minhas-reservas/${BOOKING}/agenda.ics`)
    expect(link.hasAttribute('download')).toBe(true)
  })

  it('cria o link na hora do clique e oferece WhatsApp com a mensagem', async () => {
    actions.shareBookingAction.mockResolvedValue({ ok: true, data: { url: URL_1 } })
    renderActions()
    fireEvent.click(screen.getByRole('button', { name: /Enviar para quem vai comigo/ }))
    expect(await screen.findByDisplayValue(URL_1)).toBeTruthy()
    expect(actions.shareBookingAction).toHaveBeenCalledWith({ bookingId: BOOKING, renew: false })
    const whatsapp = screen.getByRole('link', { name: /WhatsApp/ })
    expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain(
      'Nossa hospedagem na Pousada Teste, de 14/11/2026 a 17/11/2026',
    )
    expect(screen.getByText(/sem valores nem os seus dados/)).toBeTruthy()
  })

  it('gerar outro link troca o endereço; desativar some com ele', async () => {
    actions.shareBookingAction
      .mockResolvedValueOnce({ ok: true, data: { url: URL_1 } })
      .mockResolvedValueOnce({ ok: true, data: { url: URL_2 } })
    actions.revokeBookingShareAction.mockResolvedValue({ ok: true, data: { ok: true } })
    renderActions()
    fireEvent.click(screen.getByRole('button', { name: /Enviar para quem vai comigo/ }))
    await screen.findByDisplayValue(URL_1)
    fireEvent.click(screen.getByRole('button', { name: /Gerar outro link/ }))
    expect(await screen.findByDisplayValue(URL_2)).toBeTruthy()
    expect(actions.shareBookingAction).toHaveBeenLastCalledWith({ bookingId: BOOKING, renew: true })
    fireEvent.click(screen.getByRole('button', { name: /Desativar link/ }))
    expect(await screen.findByText(/Link desativado/)).toBeTruthy()
    expect(screen.queryByDisplayValue(URL_2)).toBeNull()
  })

  it('erro do servidor aparece para a pessoa', async () => {
    actions.shareBookingAction.mockResolvedValue({
      ok: false,
      error: 'Esta reserva foi cancelada.',
    })
    renderActions()
    fireEvent.click(screen.getByRole('button', { name: /Enviar para quem vai comigo/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('Esta reserva foi cancelada.')
  })
})
