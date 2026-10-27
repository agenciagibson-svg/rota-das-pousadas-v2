// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const actions = vi.hoisted(() => ({
  previewCouponAction: vi.fn(),
  createCouponAction: vi.fn(),
  setCouponActiveAction: vi.fn(),
  setCouponFeaturedAction: vi.fn(),
}))
vi.mock('../actions', () => actions)

import { CouponField } from './coupon-field'
import { useCoupon } from './use-coupon'

// Dados sintéticos.
const ROOM = '20000000-0000-4000-8000-000000000101'
const OK = {
  ok: true,
  data: {
    ok: true,
    code: 'DIRETO10',
    kind: 'percent',
    value: 10,
    subtotal: 1000,
    discount: 100,
    total: 900,
  },
}

function Harness({
  ready = true,
  initialCode,
  checkout = '2096-03-12',
}: {
  ready?: boolean
  initialCode?: string
  checkout?: string
}) {
  const coupon = useCoupon({
    roomId: ROOM,
    checkin: '2096-03-10',
    checkout,
    ready,
    initialCode,
  })
  return (
    <>
      <CouponField coupon={coupon} />
      <output data-testid="pending">{String(coupon.pendingCode)}</output>
      <output data-testid="applied">{coupon.applied?.discount ?? 'nenhum'}</output>
    </>
  )
}

describe('CouponField + useCoupon', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('aplica o cupom e mostra o desconto e o total que o banco calculou', async () => {
    actions.previewCouponAction.mockResolvedValue(OK)
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Tenho um cupom/ }))
    fireEvent.change(screen.getByLabelText('Cupom de desconto'), { target: { value: 'direto10' } })
    expect(screen.getByTestId('pending').textContent).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(await screen.findByText('Total com desconto')).toBeTruthy()
    expect(screen.getByText('R$ 900,00')).toBeTruthy()
    expect(screen.getByText('−R$ 100,00')).toBeTruthy()
    expect(screen.getByTestId('pending').textContent).toBe('false')
    expect(actions.previewCouponAction).toHaveBeenCalledWith({
      roomId: ROOM,
      checkin: '2096-03-10',
      checkout: '2096-03-12',
      code: 'DIRETO10',
    })
  })

  it('cupom que não vale: mensagem genérica e nenhum desconto', async () => {
    actions.previewCouponAction.mockResolvedValue({
      ok: true,
      data: { ok: false, reason: 'invalid' },
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Tenho um cupom/ }))
    fireEvent.change(screen.getByLabelText('Cupom de desconto'), { target: { value: 'CHUTE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Cupom inválido ou indisponível.')
    expect(screen.queryByText('Total com desconto')).toBeNull()
    expect(screen.getByTestId('applied').textContent).toBe('nenhum')
  })

  it('sem valor das datas na tela, não dá para aplicar', () => {
    render(<Harness ready={false} initialCode="DIRETO10" />)
    expect(screen.getByRole('button', { name: 'Aplicar' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/espere o valor aparecer/)).toBeTruthy()
    expect(actions.previewCouponAction).not.toHaveBeenCalled()
  })

  it('código vindo da bio é aplicado sozinho uma vez', async () => {
    actions.previewCouponAction.mockResolvedValue(OK)
    render(<Harness initialCode="DIRETO10" />)
    expect((screen.getByLabelText('Cupom de desconto') as HTMLInputElement).value).toBe('DIRETO10')
    expect(await screen.findByText('Total com desconto')).toBeTruthy()
    expect(actions.previewCouponAction).toHaveBeenCalledTimes(1)
  })

  it('mudar as datas recalcula o cupom aplicado', async () => {
    actions.previewCouponAction.mockResolvedValueOnce(OK).mockResolvedValueOnce({
      ok: true,
      data: { ...OK.data, subtotal: 1500, discount: 150, total: 1350 },
    })
    const { rerender } = render(<Harness initialCode="DIRETO10" />)
    expect(await screen.findByText('R$ 900,00')).toBeTruthy()
    rerender(<Harness initialCode="DIRETO10" checkout="2096-03-13" />)
    expect(await screen.findByText('R$ 1.350,00')).toBeTruthy()
    expect(actions.previewCouponAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ checkout: '2096-03-13', code: 'DIRETO10' }),
    )
  })

  it('remover o cupom limpa o desconto', async () => {
    actions.previewCouponAction.mockResolvedValue(OK)
    render(<Harness initialCode="DIRETO10" />)
    fireEvent.click(await screen.findByRole('button', { name: /Remover cupom/ }))
    await waitFor(() => expect(screen.getByTestId('applied').textContent).toBe('nenhum'))
    expect(screen.getByRole('button', { name: /Tenho um cupom/ })).toBeTruthy()
  })
})
