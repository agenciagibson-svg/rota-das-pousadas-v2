// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const actions = vi.hoisted(() => ({
  previewCouponAction: vi.fn(),
  createCouponAction: vi.fn(),
  setCouponActiveAction: vi.fn(),
  setCouponFeaturedAction: vi.fn(),
}))
vi.mock('../actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { DirectBookingPerk } from './direct-booking-perk'
import { CouponCard, couponStatus } from './coupon-card'
import type { Coupon } from '../types'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DirectBookingPerk (bio e página da pousada)', () => {
  it('texto sai dos dados do cupom, sem promessa que a Rota não prova', () => {
    render(
      <DirectBookingPerk
        coupon={{
          code: 'DIRETO10',
          kind: 'percent',
          value: 10,
          minNights: 2,
          validUntil: '2096-12-31',
          stayFrom: null,
          stayUntil: null,
        }}
      />,
    )
    const perk = screen.getByRole('complementary', { name: 'Vantagem de reservar direto' })
    expect(perk.textContent).toContain(
      'Reservando direto aqui: use o cupom DIRETO10 e ganhe 10% de desconto.',
    )
    expect(perk.textContent).toContain('Estadia mínima de 2 noites')
    expect(perk.textContent).toContain('Válido até 31/12/2096')
    expect(perk.textContent?.toLowerCase()).not.toContain('melhor preço')
    expect(perk.textContent?.toLowerCase()).not.toContain('garantid')
  })

  it('valor fixo aparece em reais', () => {
    render(
      <DirectBookingPerk
        coupon={{
          code: 'FIXO50',
          kind: 'fixed',
          value: 50,
          minNights: null,
          validUntil: null,
          stayFrom: null,
          stayUntil: null,
        }}
      />,
    )
    expect(screen.getByText('R$ 50')).toBeTruthy()
    expect(screen.getByText(/Para estadias acima de R\$ 50/)).toBeTruthy()
  })
})

const BASE: Coupon = {
  id: '50000000-0000-4000-8000-000000000001',
  code: 'FIXO50',
  kind: 'fixed',
  value: 50,
  validFrom: null,
  validUntil: null,
  stayFrom: null,
  stayUntil: null,
  minNights: null,
  maxUses: 1,
  active: true,
  featured: true,
  uses: 1,
  createdAt: '2096-01-01T00:00:00Z',
}

describe('CouponCard (painel)', () => {
  it('mostra quantas vezes foi usado e avisa quando esgotou', () => {
    render(
      <CouponCard
        coupon={BASE}
        todayISO="2096-03-01"
        pending={false}
        onToggleActive={vi.fn()}
        onToggleFeatured={vi.fn()}
      />,
    )
    expect(screen.getByText('Usado 1 vez de 1')).toBeTruthy()
    expect(screen.getByText('Esgotado')).toBeTruthy()
    expect(screen.getByText('Escolhido para a bio (não aparece agora)')).toBeTruthy()
  })

  it('pausar e divulgar chamam as ações', () => {
    const onToggleActive = vi.fn()
    const onToggleFeatured = vi.fn()
    render(
      <CouponCard
        coupon={{ ...BASE, featured: false, maxUses: null, uses: 3 }}
        todayISO="2096-03-01"
        pending={false}
        onToggleActive={onToggleActive}
        onToggleFeatured={onToggleFeatured}
      />,
    )
    expect(screen.getByText('Usado 3 vezes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Divulgar na bio/ }))
    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }))
    expect(onToggleFeatured).toHaveBeenCalledTimes(1)
    expect(onToggleActive).toHaveBeenCalledTimes(1)
  })

  it('cupom pausado não oferece divulgar', () => {
    render(
      <CouponCard
        coupon={{ ...BASE, active: false, featured: false }}
        todayISO="2096-03-01"
        pending={false}
        onToggleActive={vi.fn()}
        onToggleFeatured={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /Divulgar/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Reativar/ })).toBeTruthy()
  })

  it('situação do cupom pela data de hoje da pousada', () => {
    const c = { ...BASE, maxUses: null }
    expect(couponStatus({ ...c, validUntil: '2096-02-28' }, '2096-03-01')).toBe('Vencido')
    expect(couponStatus({ ...c, validFrom: '2096-03-02' }, '2096-03-01')).toBe('Ainda não começou')
    expect(couponStatus(c, '2096-03-01')).toBeNull()
  })
})
