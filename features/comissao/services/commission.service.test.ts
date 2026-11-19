import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  getCurrentUser: vi.fn(),
  getCommissionStatementRpc: vi.fn(),
  listPlatformCommissionsRpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-capability', () => ({ requireCapability: mocks.requireCapability }))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/commissions.repository', () => ({
  getCommissionStatementRpc: mocks.getCommissionStatementRpc,
  listPlatformCommissionsRpc: mocks.listPlatformCommissionsRpc,
}))

import { getCommissionStatement, listPlatformCommissions } from './commission.service'

const POUSADA = '10000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireCapability.mockResolvedValue({ pousadaId: POUSADA, role: 'financeiro_pousada' })
})

describe('getCommissionStatement', () => {
  it('pede acesso ao financeiro e usa a pousada ativa', async () => {
    mocks.getCommissionStatementRpc.mockResolvedValue({ months: [] })
    await getCommissionStatement('2026-12-01')
    expect(mocks.requireCapability).toHaveBeenCalledWith('finance:pousada:view')
    expect(mocks.getCommissionStatementRpc).toHaveBeenCalledWith(POUSADA, '2026-12-01')
  })

  it('sem mês, deixa o banco escolher o mais recente', async () => {
    mocks.getCommissionStatementRpc.mockResolvedValue({ months: [] })
    await getCommissionStatement(null)
    expect(mocks.getCommissionStatementRpc).toHaveBeenCalledWith(POUSADA, null)
  })

  it('quem não vê o financeiro nem chega ao banco', async () => {
    mocks.requireCapability.mockRejectedValue(new Error('Você não tem permissão para esta ação.'))
    await expect(getCommissionStatement(null)).rejects.toThrow('permissão')
    expect(mocks.getCommissionStatementRpc).not.toHaveBeenCalled()
  })
})

describe('listPlatformCommissions', () => {
  it('só financeiro da plataforma e master', async () => {
    for (const user of [
      null,
      { id: 'u', platformRole: null },
      { id: 'u', platformRole: 'comercial' },
      { id: 'u', platformRole: 'suporte' },
    ]) {
      mocks.getCurrentUser.mockResolvedValue(user)
      await expect(listPlatformCommissions(null)).rejects.toThrow('exclusivo')
    }
    expect(mocks.listPlatformCommissionsRpc).not.toHaveBeenCalled()

    for (const platformRole of ['financeiro_plataforma', 'master']) {
      mocks.getCurrentUser.mockResolvedValue({ id: 'u', platformRole })
      mocks.listPlatformCommissionsRpc.mockResolvedValue({ months: [], pousadas: [] })
      await expect(listPlatformCommissions('2026-12-01')).resolves.toEqual({
        months: [],
        pousadas: [],
      })
    }
    expect(mocks.listPlatformCommissionsRpc).toHaveBeenCalledTimes(2)
    expect(mocks.listPlatformCommissionsRpc).toHaveBeenLastCalledWith('2026-12-01')
  })
})
