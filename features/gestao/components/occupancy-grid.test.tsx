// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const m = vi.hoisted(() => ({
  move: vi.fn(),
  quote: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }))
vi.mock('../actions', () => ({ moveBookingAction: m.move }))
vi.mock('@/features/acomodacoes/actions', () => ({ quoteCounterStayAction: m.quote }))

import { OccupancyGrid } from './occupancy-grid'
import type { OccupancyBoard, OccupancyBooking } from '../occupancy'

function booking(over: Partial<OccupancyBooking>): OccupancyBooking {
  return {
    id: 'b1',
    code: 'RP-AAA111',
    roomId: 'r1',
    guestName: 'Ana Teste',
    checkin: '2026-11-03',
    checkout: '2026-11-05',
    status: 'confirmed',
    origin: 'balcao',
    guests: 2,
    pets: false,
    subtotal: 600,
    total: 600,
    amountReceived: 0,
    version: 4,
    ...over,
  }
}

const board: OccupancyBoard = {
  from: '2026-11-01',
  days: 14,
  today: '2026-11-02',
  rooms: [
    { id: 'r1', name: 'Chalé 1', capacity: 2, petsAllowed: false, unavailable: false },
    { id: 'r2', name: 'Chalé 2', capacity: 2, petsAllowed: false, unavailable: false },
  ],
  bookings: [
    booking({}),
    booking({
      id: 'b2',
      code: 'RP-AIR',
      guestName: 'Bia Airbnb',
      roomId: 'r2',
      origin: 'airbnb',
      checkin: '2026-11-07',
      checkout: '2026-11-09',
    }),
  ],
  holds: [
    {
      id: 'h1',
      roomId: 'r2',
      startsOn: '2026-11-10',
      endsOn: '2026-11-12',
      kind: 'channel',
      label: 'Booking.com',
    },
  ],
}

// jsdom não tem PointerEvent: sem ele o evento perde clientX/pointerType.
class TestPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.pointerType = init.pointerType ?? 'mouse'
  }
}
Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true })

// jsdom não mede layout: faixa de 14 colunas × 48px e linha de 56px.
const rect = (width: number, height: number) =>
  ({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect

beforeEach(() => {
  m.move.mockReset()
  m.quote.mockReset()
  m.quote.mockResolvedValue({ ok: true, data: { total: 900, nights: 2, minNights: 1 } })
  m.move.mockResolvedValue({
    ok: true,
    data: { id: 'b1', version: 5, total: 600, previousTotal: 600 },
  })
  HTMLElement.prototype.setPointerCapture = vi.fn()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-occupancy-track')) return rect(14 * 48, 56)
    if (this.hasAttribute('data-occupancy-row')) return rect(800, 56)
    return rect(0, 0)
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('mapa de ocupação', () => {
  it('noite livre leva para Nova reserva com quarto e entrada; passado e ocupado não', () => {
    render(<OccupancyGrid board={board} />)
    const link = screen.getByRole('link', { name: 'Nova reserva: Chalé 1, entrada 05/11' })
    expect(link.getAttribute('href')).toBe(
      '/dashboard/reservas/nova?quarto=r1&entrada=2026-11-05&saida=2026-11-06',
    )
    expect(screen.queryByRole('link', { name: 'Nova reserva: Chalé 1, entrada 01/11' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Nova reserva: Chalé 1, entrada 03/11' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Nova reserva: Chalé 2, entrada 10/11' })).toBeNull()
    expect(screen.getByText('Ocupado no Booking.com')).toBeTruthy()
  })

  it('"Mover" pelo menu (celular/teclado): confirma mantendo o valor', async () => {
    render(<OccupancyGrid board={board} />)
    fireEvent.click(screen.getByRole('button', { name: /^Ana Teste, Chalé 1/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'r2' } })
    expect(screen.getByText('Para')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Usar o valor novo/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
    await waitFor(() =>
      expect(m.move).toHaveBeenCalledWith({
        bookingId: 'b1',
        version: 4,
        roomId: 'r2',
        checkin: '2026-11-03',
        checkout: '2026-11-05',
        reprice: false,
      }),
    )
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Chalé 2'))
  })

  it('escolher o valor novo manda só o pedido, nunca o número', async () => {
    render(<OccupancyGrid board={board} />)
    fireEvent.click(screen.getByRole('button', { name: /^Ana Teste, Chalé 1/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))
    fireEvent.change(screen.getByLabelText('Saída'), { target: { value: '2026-11-06' } })
    await waitFor(() => screen.getByText(/Usar o valor novo/))
    fireEvent.click(screen.getByRole('radio', { name: /Usar o valor novo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
    await waitFor(() =>
      expect(m.move).toHaveBeenCalledWith(expect.objectContaining({ reprice: true })),
    )
    expect(Object.keys(m.move.mock.calls[0]![0])).not.toContain('total')
  })

  it('reserva do Airbnb: explica e não oferece Mover', () => {
    render(<OccupancyGrid board={board} />)
    fireEvent.click(screen.getByRole('button', { name: /^Bia Airbnb/ }))
    expect(screen.getByText(/mude primeiro no canal/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mover' })).toBeNull()
  })

  it('arrastar com o mouse abre a confirmação com o destino', async () => {
    render(<OccupancyGrid board={board} />)
    const bar = screen.getByRole('button', { name: /^Ana Teste, Chalé 1/ })
    await act(async () => {
      fireEvent.pointerDown(bar, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 100,
        clientY: 20,
      })
      fireEvent.pointerMove(bar, { pointerId: 1, pointerType: 'mouse', clientX: 196, clientY: 76 })
    })
    expect(screen.getByText(/Chalé 2: 05\/11 a 07\/11/)).toBeTruthy()
    await act(async () => {
      fireEvent.pointerUp(bar, { pointerId: 1, pointerType: 'mouse', clientX: 196, clientY: 76 })
      fireEvent.click(bar) // o clique que segue o arrasto não abre o menu
    })
    expect(screen.getByText('Mover reserva de Ana Teste')).toBeTruthy()
    expect((screen.getByLabelText('Entrada') as HTMLInputElement).value).toBe('2026-11-05')
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('r2')
  })

  it('soltar em cima de outra ocupação avisa e não abre nada', async () => {
    render(<OccupancyGrid board={board} />)
    const bar = screen.getByRole('button', { name: /^Ana Teste, Chalé 1/ })
    await act(async () => {
      // 7 noites para frente e uma linha para baixo: cai no Booking.com do Chalé 2.
      fireEvent.pointerDown(bar, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerMove(bar, { pointerId: 1, pointerType: 'mouse', clientX: 336, clientY: 56 })
      fireEvent.pointerUp(bar, { pointerId: 1, pointerType: 'mouse', clientX: 336, clientY: 56 })
    })
    expect(screen.getByRole('alert').textContent).toContain('Não dá para soltar aí')
    expect(screen.queryByText('Mover reserva de Ana Teste')).toBeNull()
  })

  it('toque não arrasta (rola o mapa)', async () => {
    render(<OccupancyGrid board={board} />)
    const bar = screen.getByRole('button', { name: /^Ana Teste, Chalé 1/ })
    await act(async () => {
      fireEvent.pointerDown(bar, {
        pointerId: 2,
        pointerType: 'touch',
        button: 0,
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerMove(bar, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 0 })
    })
    expect(screen.queryByText(/05\/11 a 07\/11/)).toBeNull()
  })
})
