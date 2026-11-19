// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CommissionStatementCard } from './commission-statement-card'
import { PlatformCommissionsCard } from './platform-commissions-card'
import type { CommissionStatement, PlatformCommissions } from '../types'

afterEach(() => cleanup())

// Dados sintéticos.
const STATEMENT: CommissionStatement = {
  rate: 0.06,
  hasContract: true,
  exemptUntil: null,
  month: '2098-03-01',
  months: [
    { month: '2098-04-01', bookings: 1, base: 450, due: 27, waived: 0 },
    { month: '2098-03-01', bookings: 2, base: 2000, due: 60, waived: 60 },
  ],
  items: [
    {
      bookingId: 'b1',
      code: 'RP-AAA111',
      checkin: '2098-03-10',
      checkout: '2098-03-12',
      origin: 'rota_das_pousadas',
      base: 1000,
      rate: 0.06,
      amount: 60,
      exempt: false,
    },
    {
      bookingId: 'b2',
      code: 'RP-BBB222',
      checkin: '2098-03-18',
      checkout: '2098-03-20',
      origin: 'link_bio',
      base: 1000,
      rate: 0.06,
      amount: 60,
      exempt: true,
    },
  ],
}

const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''

describe('CommissionStatementCard', () => {
  it('mostra o mês aberto, o devido, o dispensado e cada reserva', () => {
    render(<CommissionStatementCard statement={STATEMENT} basePath="/dashboard/financeiro" />)
    expect(text()).toContain('Comissão da Rota (6%)')
    expect(text()).toMatch(/Comissão de março de 2098\s*R\$ 60,00/)
    expect(text()).toMatch(/Dispensada pela isenção no mês\s*R\$ 60,00/)
    expect(text()).toContain('3 · R$ 2.450,00')
    expect(text()).toContain('RP-AAA111')
    expect(text()).toContain('10/03/2098 a 12/03/2098')
    // A isenta aparece como isenta, com o valor dispensado, nunca como devida.
    expect(text()).toContain('Isenta (R$ 60,00)')
  })

  it('os meses viram links com o mês na URL, e o aberto fica marcado', () => {
    render(<CommissionStatementCard statement={STATEMENT} basePath="/dashboard/financeiro" />)
    const abril = screen.getByRole('link', { name: 'abril de 2098' })
    expect(abril.getAttribute('href')).toBe('/dashboard/financeiro?mes=2098-04')
    expect(abril.getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: 'março de 2098' }).getAttribute('aria-current')).toBe(
      'page',
    )
  })

  it('sem comissão registrada, explica em vez de mostrar tabela vazia', () => {
    render(
      <CommissionStatementCard
        statement={{ ...STATEMENT, months: [], items: [] }}
        basePath="/dashboard/financeiro"
      />,
    )
    expect(text()).toContain('Nenhuma reserva feita pela Rota com check-out até agora.')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('isenção em andamento aparece no topo; a que já acabou não', () => {
    const { unmount } = render(
      <CommissionStatementCard
        statement={{ ...STATEMENT, exemptUntil: '2999-01-30T12:00:00Z' }}
        basePath="/x"
      />,
    )
    expect(text()).toContain('Sem comissão até 30/01/2999')
    unmount()
    render(
      <CommissionStatementCard
        statement={{ ...STATEMENT, exemptUntil: '2001-01-30T12:00:00Z' }}
        basePath="/x"
      />,
    )
    expect(text()).not.toContain('Sem comissão até')
  })
})

describe('PlatformCommissionsCard', () => {
  const DATA: PlatformCommissions = {
    rate: 0.06,
    month: '2098-03-01',
    months: [{ month: '2098-03-01', bookings: 2, pousadas: 1, base: 2000, due: 60, waived: 60 }],
    pousadas: [
      {
        pousadaId: 'p1',
        name: 'Pousada Exemplo',
        founderRank: 3,
        exemptUntil: null,
        bookings: 2,
        base: 2000,
        due: 60,
        waived: 60,
      },
    ],
  }

  it('deixa claro que é o gerado, não o recebido, e lista as pousadas', () => {
    render(<PlatformCommissionsCard data={DATA} basePath="/admin/financeiro" />)
    expect(text()).toContain('não o que foi recebido')
    expect(text()).toMatch(/Gerada em março de 2098\s*R\$ 60,00/)
    expect(text()).toContain('Pousada Exemplo')
    expect(text()).toContain('Fundadora nº 3')
    expect(text()).toContain('R$ 2.000,00')
  })

  it('sem nada registrado, explica quando a comissão aparece', () => {
    render(
      <PlatformCommissionsCard
        data={{ ...DATA, months: [], pousadas: [] }}
        basePath="/admin/financeiro"
      />,
    )
    expect(text()).toContain('Nenhuma comissão registrada ainda.')
    expect(screen.queryByRole('table')).toBeNull()
  })
})
