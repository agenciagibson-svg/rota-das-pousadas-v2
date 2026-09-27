import { describe, expect, it } from 'vitest'
import {
  canAccessSection,
  sectionForHref,
  SECTION_ACCESS,
  type DashboardSection,
} from './dashboard-sections'

const ALL = Object.keys(SECTION_ACCESS) as DashboardSection[]

describe('canAccessSection', () => {
  it('proprietário abre todas as áreas', () => {
    for (const s of ALL) expect(canAccessSection('proprietario', s)).toBe(true)
  })

  it('recepção não vê financeiro, membros nem configurações', () => {
    expect(canAccessSection('recepcionista', 'reservas')).toBe(true)
    expect(canAccessSection('recepcionista', 'financeiro')).toBe(false)
    expect(canAccessSection('recepcionista', 'configuracoes')).toBe(false)
  })

  it('estoque e pedidos por papel', () => {
    expect(canAccessSection('governanca', 'estoque')).toBe(true)
    expect(canAccessSection('governanca', 'pedidos')).toBe(true)
    expect(canAccessSection('financeiro_pousada', 'pedidos')).toBe(false)
    expect(canAccessSection('financeiro_pousada', 'estoque')).toBe(true)
    expect(canAccessSection('recepcionista', 'pedidos')).toBe(true)
  })

  it('financeiro da pousada vê o financeiro', () => {
    expect(canAccessSection('financeiro_pousada', 'financeiro')).toBe(true)
  })

  it('sem papel só a visão geral', () => {
    expect(canAccessSection(null, 'overview')).toBe(true)
    expect(canAccessSection(null, 'reservas')).toBe(false)
  })
})

describe('sectionForHref', () => {
  it('mapeia links do menu', () => {
    expect(sectionForHref('/dashboard')).toBe('overview')
    expect(sectionForHref('/dashboard/reservas')).toBe('reservas')
    expect(sectionForHref('/dashboard/reservas/nova')).toBe('reservas')
    expect(sectionForHref('/dashboard/acomodacoes/canais')).toBe('canais')
    expect(sectionForHref('/dashboard/acomodacoes')).toBe('acomodacoes')
    expect(sectionForHref('/admin')).toBeNull()
  })
})
