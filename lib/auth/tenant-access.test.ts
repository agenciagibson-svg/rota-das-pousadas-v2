import { describe, it, expect } from 'vitest'
import { classifyTenantAccess } from './tenant-access'
import type { TenantMembership } from '@/features/auth/types'

function membership(overrides: Partial<TenantMembership>): TenantMembership {
  return {
    id: 'm-1',
    pousadaId: 'pousada-1',
    role: 'proprietario',
    status: 'active',
    suspendedReason: null,
    ...overrides,
  }
}

describe('classifyTenantAccess', () => {
  it('sem nenhum vínculo (ou só revogados) -> no_membership', () => {
    expect(classifyTenantAccess([], null).status).toBe('no_membership')
    expect(classifyTenantAccess([membership({ status: 'revoked' })], null).status).toBe(
      'no_membership',
    )
  })

  it('único vínculo ativo -> ok, resolvido automaticamente sem cookie', () => {
    const result = classifyTenantAccess([membership({ status: 'active' })], null)
    expect(result.status).toBe('ok')
  })

  it('vínculo suspenso (sem nenhum ativo) -> suspended, nunca concede acesso', () => {
    const result = classifyTenantAccess([membership({ status: 'suspended' })], null)
    expect(result.status).toBe('suspended')
  })

  it('só convite pendente (sem ativo, sem suspenso) -> invited_only', () => {
    const result = classifyTenantAccess([membership({ status: 'invited' })], null)
    expect(result.status).toBe('invited_only')
  })

  it('suspenso tem prioridade sobre convite pendente quando ambos existem e nenhum é ativo', () => {
    const result = classifyTenantAccess(
      [
        membership({ id: 'a', pousadaId: 'p1', status: 'invited' }),
        membership({ id: 'b', pousadaId: 'p2', status: 'suspended' }),
      ],
      null,
    )
    expect(result.status).toBe('suspended')
  })

  it('múltiplos vínculos ativos sem cookie -> needs_selection', () => {
    const result = classifyTenantAccess(
      [
        membership({ id: 'a', pousadaId: 'p1', status: 'active' }),
        membership({ id: 'b', pousadaId: 'p2', status: 'active' }),
      ],
      null,
    )
    expect(result.status).toBe('needs_selection')
  })

  it('múltiplos vínculos ativos com cookie válido -> ok na pousada selecionada', () => {
    const result = classifyTenantAccess(
      [
        membership({ id: 'a', pousadaId: 'p1', status: 'active' }),
        membership({ id: 'b', pousadaId: 'p2', status: 'active' }),
      ],
      'p2',
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.membership.pousadaId).toBe('p2')
  })

  it('cookie apontando para pousada sem vínculo ativo é ignorado -> needs_selection (nunca confia no cookie sozinho)', () => {
    const result = classifyTenantAccess(
      [
        membership({ id: 'a', pousadaId: 'p1', status: 'active' }),
        membership({ id: 'b', pousadaId: 'p2', status: 'active' }),
      ],
      'pousada-inexistente',
    )
    expect(result.status).toBe('needs_selection')
  })

  it('cookie apontando para pousada onde o vínculo está suspenso é ignorado', () => {
    const result = classifyTenantAccess(
      [
        membership({ id: 'a', pousadaId: 'p1', status: 'active' }),
        membership({ id: 'b', pousadaId: 'p2', status: 'suspended' }),
      ],
      'p2',
    )
    // só há 1 ativo (p1) — resolve sozinho, ignorando o cookie inválido para p2.
    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.membership.pousadaId).toBe('p1')
  })
})
