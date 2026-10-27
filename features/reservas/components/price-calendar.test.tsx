// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PriceCalendar } from './price-calendar'
import { PriceCalendarGrid } from './price-calendar-grid'
import { buildCalendarMonth, type PriceCalendarDay } from '../price-calendar'

// Novembro de 2026; "hoje" = 03/11. Dados sintéticos.
const TODAY = '2026-11-03'
const rows: PriceCalendarDay[] = [
  { date: '2026-11-03', fromPrice: 200, available: true, minNights: 1 },
  { date: '2026-11-04', fromPrice: 1200, available: true, minNights: 1 },
  { date: '2026-11-05', fromPrice: null, available: false, minNights: 1 },
  { date: '2026-11-06', fromPrice: 300, available: true, minNights: 3 },
]

describe('PriceCalendar', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ days: rows }) })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function renderCalendar(props: Partial<Parameters<typeof PriceCalendar>[0]> = {}) {
    const onChange = vi.fn()
    render(
      <PriceCalendar
        slug="pousada-teste"
        guests={2}
        today={TODAY}
        checkin=""
        checkout=""
        onChange={onChange}
        {...props}
      />,
    )
    return onChange
  }

  it('busca o mês pela rota pública com hóspedes e mostra a diária em cada dia', async () => {
    renderCalendar({ roomId: '11111111-1111-4111-8111-111111111111' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/pousada/pousada-teste/calendario?mes=2026-11&hospedes=2&quarto=11111111-1111-4111-8111-111111111111',
      expect.anything(),
    )
    const day4 = await screen.findByRole('button', {
      name: /, 4 de novembro.*a partir de R\$ 1\.200/,
    })
    expect(day4.textContent).toContain('1.200')
    expect(screen.getByText('Novembro de 2026')).toBeTruthy()
  })

  it('dia sem vaga e dia passado ficam desabilitados', async () => {
    renderCalendar()
    const full = await screen.findByRole('button', { name: /, 5 de novembro.*sem vaga/ })
    expect((full as HTMLButtonElement).disabled).toBe(true)
    const past = screen.getByRole('button', { name: /, 2 de novembro.*data passada/ })
    expect((past as HTMLButtonElement).disabled).toBe(true)
  })

  it('avisa a estadia mínima no dia e ao escolher a entrada', async () => {
    const onChange = renderCalendar()
    const day6 = await screen.findByRole('button', {
      name: /, 6 de novembro.*estadia mínima de 3 noites/,
    })
    fireEvent.click(day6)
    expect(onChange).toHaveBeenCalledWith({ checkin: '2026-11-06', checkout: '' })
  })

  it('escolhendo a saída: respeita o mínimo e a noite lotada', async () => {
    const onChange = renderCalendar({ checkin: '2026-11-03' })
    await screen.findByRole('button', { name: /, 4 de novembro.*a partir de/ })
    expect(screen.getByText(/Agora toque no dia da saída/)).toBeTruthy()
    // Sair no dia 05 é possível (a noite lotada é a de 05 para 06).
    fireEvent.click(screen.getByRole('button', { name: /, 5 de novembro/ }))
    expect(onChange).toHaveBeenLastCalledWith({ checkin: '2026-11-03', checkout: '2026-11-05' })
    expect(
      (screen.getByRole('button', { name: /, 6 de novembro/ }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('não volta para antes do mês de hoje e busca o próximo mês ao avançar', async () => {
    renderCalendar()
    expect(
      (screen.getByRole('button', { name: 'Mês anterior' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/pousada/pousada-teste/calendario?mes=2026-12&hospedes=2',
        expect.anything(),
      ),
    )
    expect(screen.getByText('Dezembro de 2026')).toBeTruthy()
  })

  it('falha na busca não trava: avisa e deixa escolher', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    const onChange = renderCalendar()
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /, 10 de novembro/ }))
    expect(onChange).toHaveBeenCalledWith({ checkin: '2026-11-10', checkout: '' })
  })
})

describe('PriceCalendarGrid com links (página da bio, sem JavaScript)', () => {
  afterEach(cleanup)

  it('dia disponível vira link; dia sem vaga não', () => {
    const days = Object.fromEntries(rows.map((r) => [r.date, r]))
    const month = buildCalendarMonth({
      month: '2026-11',
      days,
      today: TODAY,
      selection: { checkin: '', checkout: '' },
    })
    render(<PriceCalendarGrid month={month} hrefFor={(date) => `/pousada-teste?checkin=${date}`} />)
    const link = screen.getByRole('link', { name: /, 4 de novembro/ })
    expect(link.getAttribute('href')).toBe('/pousada-teste?checkin=2026-11-04')
    expect(screen.queryByRole('link', { name: /, 5 de novembro/ })).toBeNull()
    expect(screen.getByLabelText(/, 5 de novembro.*sem vaga/)).toBeTruthy()
  })
})
