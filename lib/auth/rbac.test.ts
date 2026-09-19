import { describe, it, expect } from 'vitest'
import { can, canAny, isPlatformRole, isTenantRole, type Role } from './rbac'

describe('rbac.can', () => {
  it('permite viajante criar reserva e pagar', () => {
    expect(can('viajante', 'booking:create')).toBe(true)
    expect(can('viajante', 'payment:pay')).toBe(true)
  })

  it('nega viajante de gerenciar pousada ou aprovar', () => {
    expect(can('viajante', 'pousada:edit')).toBe(false)
    expect(can('viajante', 'pousada:approve')).toBe(false)
  })

  it('permite proprietário gerenciar sua pousada e receber payout', () => {
    expect(can('proprietario', 'pousada:edit')).toBe(true)
    expect(can('proprietario', 'payout:receive')).toBe(true)
    expect(can('proprietario', 'pricing:manage')).toBe(true)
  })

  it('nega admin_pousada de excluir pousada ou receber payout', () => {
    expect(can('admin_pousada', 'pousada:delete')).toBe(false)
    expect(can('admin_pousada', 'payout:receive')).toBe(false)
  })

  it('recepcionista faz check-in mas não vê financeiro', () => {
    expect(can('recepcionista', 'checkin:perform')).toBe(true)
    expect(can('recepcionista', 'finance:pousada:view')).toBe(false)
  })

  it('somente comercial/master aprovam pousada', () => {
    expect(can('comercial', 'pousada:approve')).toBe(true)
    expect(can('master', 'pousada:approve')).toBe(true)
    expect(can('marketing', 'pousada:approve')).toBe(false)
  })

  it('somente comercial/master vinculam proprietário a pousada cadastrada pelo admin', () => {
    expect(can('comercial', 'pousada:link_owner')).toBe(true)
    expect(can('master', 'pousada:link_owner')).toBe(true)
    expect(can('marketing', 'pousada:link_owner')).toBe(false)
    expect(can('proprietario', 'pousada:link_owner')).toBe(false)
  })

  it('comercial/marketing/master gerenciam o catálogo de destinos; ninguém mais', () => {
    expect(can('comercial', 'destination:manage')).toBe(true)
    expect(can('marketing', 'destination:manage')).toBe(true)
    expect(can('master', 'destination:manage')).toBe(true)
    for (const role of ['proprietario', 'suporte', 'financeiro_plataforma'] as Role[]) {
      expect(can(role, 'destination:manage')).toBe(false)
    }
  })

  it('master pode configurar a plataforma; ninguém mais', () => {
    expect(can('master', 'platform:configure')).toBe(true)
    for (const role of ['proprietario', 'suporte', 'comercial', 'marketing'] as Role[]) {
      expect(can(role, 'platform:configure')).toBe(false)
    }
  })

  it('financeiro_plataforma/master gerenciam o financeiro da própria Rota; ninguém mais', () => {
    expect(can('financeiro_plataforma', 'platform_finance:manage')).toBe(true)
    expect(can('master', 'platform_finance:manage')).toBe(true)
    for (const role of ['proprietario', 'suporte', 'comercial', 'marketing'] as Role[]) {
      expect(can(role, 'platform_finance:manage')).toBe(false)
    }
  })

  it('IA só faz triagem de moderação, nunca ações irreversíveis', () => {
    expect(can('ia', 'content:moderate')).toBe(true)
    expect(can('ia', 'payment:pay')).toBe(false)
    expect(can('ia', 'pousada:delete')).toBe(false)
  })

  it('governança altera status operacional, mas nunca vê financeiro ou hóspede', () => {
    expect(can('governanca', 'room:status:manage')).toBe(true)
    expect(can('governanca', 'housekeeping:manage')).toBe(true)
    expect(can('governanca', 'finance:pousada:view')).toBe(false)
    expect(can('governanca', 'guest:manage')).toBe(false)
    expect(can('governanca', 'payment:register')).toBe(false)
    expect(can('governanca', 'payment:refund')).toBe(false)
  })

  it('financeiro_pousada registra recebimento e estorno, mas não faz check-in', () => {
    expect(can('financeiro_pousada', 'payment:register')).toBe(true)
    expect(can('financeiro_pousada', 'payment:refund')).toBe(true)
    expect(can('financeiro_pousada', 'checkin:perform')).toBe(false)
  })

  it('recepcionista faz check-in/checkout e registra pagamento, mas não estorna', () => {
    expect(can('recepcionista', 'checkin:perform')).toBe(true)
    expect(can('recepcionista', 'checkout:perform')).toBe(true)
    expect(can('recepcionista', 'payment:register')).toBe(true)
    expect(can('recepcionista', 'payment:refund')).toBe(false)
  })

  it('somente master gerencia concessões de acesso institucional', () => {
    expect(can('master', 'platform:grant:manage')).toBe(true)
    for (const role of [
      'suporte',
      'comercial',
      'marketing',
      'financeiro_plataforma',
      'proprietario',
    ] as Role[]) {
      expect(can(role, 'platform:grant:manage')).toBe(false)
    }
  })

  it('[Ciclo 4] proprietario/admin_pousada/recepcionista gerenciam reservas e hóspedes; financeiro e governança não', () => {
    for (const role of ['proprietario', 'admin_pousada', 'recepcionista'] as Role[]) {
      expect(can(role, 'booking:manage')).toBe(true)
      expect(can(role, 'booking:cancel')).toBe(true)
      expect(can(role, 'guest:manage')).toBe(true)
    }
    expect(can('financeiro_pousada', 'booking:manage')).toBe(false)
    expect(can('governanca', 'booking:manage')).toBe(false)
    expect(can('governanca', 'guest:manage')).toBe(false)
    expect(can('financeiro_pousada', 'guest:manage')).toBe(false)
  })

  it('[Ciclo 4] no-show é ação de equipe operacional, nunca do viajante', () => {
    expect(can('proprietario', 'booking:no_show')).toBe(true)
    expect(can('recepcionista', 'booking:no_show')).toBe(true)
    expect(can('viajante', 'booking:no_show')).toBe(false)
  })

  it('somente proprietario/master conectam conta de pagamento — muda quem recebe o dinheiro', () => {
    expect(can('proprietario', 'payment:connect_account')).toBe(true)
    expect(can('master', 'payment:connect_account')).toBe(true)
    for (const role of [
      'admin_pousada',
      'financeiro_pousada',
      'recepcionista',
      'governanca',
    ] as Role[]) {
      expect(can(role, 'payment:connect_account')).toBe(false)
    }
  })
})

describe('rbac.canAny', () => {
  it('true se qualquer papel permitir', () => {
    expect(canAny(['viajante', 'recepcionista'], 'checkin:perform')).toBe(true)
    expect(canAny(['viajante'], 'checkin:perform')).toBe(false)
  })
})

describe('rbac scopes', () => {
  it('classifica papéis de tenant e de plataforma', () => {
    expect(isTenantRole('proprietario')).toBe(true)
    expect(isTenantRole('governanca')).toBe(true)
    expect(isTenantRole('suporte')).toBe(false)
    expect(isPlatformRole('master')).toBe(true)
    expect(isPlatformRole('viajante')).toBe(false)
  })
})
