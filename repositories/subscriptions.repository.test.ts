import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPlanPreapprovalId } from './subscriptions.repository'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc, from: mocks.from }),
}))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseServiceRoleClient: vi.fn() }))

describe('setPlanPreapprovalId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava pela RPC — `plans` não tem policy de escrita e o UPDATE direto não gravava nada', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ok' }, error: null })
    await setPlanPreapprovalId('plan-1', 'mp-plan-123')
    expect(mocks.rpc).toHaveBeenCalledWith('set_plan_preapproval_id', {
      p_plan_id: 'plan-1',
      p_mp_preapproval_plan_id: 'mp-plan-123',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('propaga a recusa do banco em vez de fingir que configurou', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Somente master pode configurar o plano de assinatura da plataforma.' },
    })
    await expect(setPlanPreapprovalId('plan-1', 'mp-plan-123')).rejects.toThrow('Somente master')
  })
})
