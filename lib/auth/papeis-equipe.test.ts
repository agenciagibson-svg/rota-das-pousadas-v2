import { describe, expect, it } from 'vitest'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { can, type Role } from './rbac'
import { canAccessSection, sectionForHref, type DashboardSection } from './dashboard-sections'

/**
 * Lado do app da simulação `supabase/tests/papeis-equipe.sql`. Fixa o menu que
 * cada papel vê (é o que o roteiro de `docs/configuracao/contas-de-teste.md`
 * manda conferir no celular) e as capacidades que o teste SQL confirma no banco.
 */
function visibleMenu(role: Role): string[] {
  return ownerDashboardNav('overview')
    .filter((item) => {
      const section = item.href ? sectionForHref(item.href) : null
      return !section || canAccessSection(role, section)
    })
    .map((item) => item.label)
}

const ACOMODACOES_TABS: DashboardSection[] = [
  'categorias',
  'bloqueios',
  'tarifas',
  'disponibilidade',
  'canais',
]

describe('menu do painel por papel', () => {
  it('proprietário e gestor veem o menu inteiro', () => {
    const all = ownerDashboardNav('overview').map((item) => item.label)
    expect(visibleMenu('proprietario')).toEqual(all)
    expect(visibleMenu('admin_pousada')).toEqual(all)
  })

  it('recepção: operação do dia, sem dinheiro da casa nem equipe', () => {
    expect(visibleMenu('recepcionista')).toEqual([
      'Visão geral',
      'Reservas',
      'Pedidos',
      'Hóspedes',
      'Acomodações',
      'Estoque',
      'Link da bio',
      'Mensagens',
    ])
    expect(ACOMODACOES_TABS.filter((s) => canAccessSection('recepcionista', s))).toEqual(
      ACOMODACOES_TABS,
    )
  })

  it('governança: só quartos, pedidos e estoque', () => {
    expect(visibleMenu('governanca')).toEqual(['Visão geral', 'Pedidos', 'Acomodações', 'Estoque'])
    expect(ACOMODACOES_TABS.filter((s) => canAccessSection('governanca', s))).toEqual([
      'categorias',
      'bloqueios',
    ])
  })

  it('financeiro: reservas, financeiro e estoque', () => {
    expect(visibleMenu('financeiro_pousada')).toEqual([
      'Visão geral',
      'Reservas',
      'Financeiro',
      'Estoque',
    ])
    expect(ACOMODACOES_TABS.some((s) => canAccessSection('financeiro_pousada', s))).toBe(false)
  })
})

describe('capacidades que o teste SQL confirma no banco', () => {
  it('equipe e conta de pagamento são só do proprietário', () => {
    for (const role of [
      'admin_pousada',
      'recepcionista',
      'governanca',
      'financeiro_pousada',
    ] as const) {
      expect(can(role, 'member:invite')).toBe(false)
      expect(can(role, 'member:update_role')).toBe(false)
      expect(can(role, 'payment:connect_account')).toBe(false)
    }
    expect(can('proprietario', 'member:invite')).toBe(true)
    expect(can('admin_pousada', 'member:view')).toBe(true)
  })

  it('preço e tarifa: proprietário e gestor', () => {
    expect(can('admin_pousada', 'room:manage')).toBe(true)
    expect(can('recepcionista', 'room:manage')).toBe(false)
    expect(can('governanca', 'room:manage')).toBe(false)
    expect(can('financeiro_pousada', 'room:manage')).toBe(false)
  })

  it('recepção opera a estadia mas não estorna', () => {
    for (const action of [
      'booking:manage',
      'checkin:perform',
      'checkout:perform',
      'payment:register',
      'order:manage',
    ] as const) {
      expect(can('recepcionista', action)).toBe(true)
    }
    expect(can('recepcionista', 'payment:refund')).toBe(false)
    expect(can('recepcionista', 'finance:pousada:view')).toBe(false)
    expect(can('recepcionista', 'room:status:manage')).toBe(false)
  })

  it('governança só mexe no status do quarto', () => {
    expect(can('governanca', 'room:status:manage')).toBe(true)
    expect(can('governanca', 'booking:manage')).toBe(false)
    expect(can('governanca', 'guest:manage')).toBe(false)
    expect(can('governanca', 'payment:register')).toBe(false)
    expect(can('governanca', 'finance:pousada:view')).toBe(false)
  })

  it('financeiro vê e estorna, não opera a casa', () => {
    expect(can('financeiro_pousada', 'finance:pousada:view')).toBe(true)
    expect(can('financeiro_pousada', 'payment:refund')).toBe(true)
    expect(can('financeiro_pousada', 'checkin:perform')).toBe(false)
    expect(can('financeiro_pousada', 'room:status:manage')).toBe(false)
    expect(can('financeiro_pousada', 'booking:manage')).toBe(false)
    // ACHADO (ver papeis-equipe.sql, seção 7): `payment:register` deixa o
    // financeiro aprovar comprovante Pix (o banco também deixa) e abre a lista
    // de Reservas, mas o detalhe da reserva exige `booking:manage` — o
    // financeiro clica na reserva e vê "Não foi possível abrir esta reserva".
    expect(can('financeiro_pousada', 'payment:register')).toBe(true)
    expect(canAccessSection('financeiro_pousada', 'reservas')).toBe(true)
    expect(canAccessSection('financeiro_pousada', 'nova_reserva')).toBe(false)
  })
})
