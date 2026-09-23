import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listMembershipsByPousada } from './memberships.repository'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ from: mocks.from, rpc: mocks.rpc }),
}))

const memberRows = [
  {
    id: 'm-1',
    user_id: 'user-owner',
    role: 'proprietario',
    status: 'active',
    invited_at: null,
    accepted_at: null,
    created_at: '2026-09-01T00:00:00+00:00',
    suspended_reason: null,
  },
  {
    id: 'm-2',
    user_id: 'user-recepcao',
    role: 'recepcionista',
    status: 'active',
    invited_at: null,
    accepted_at: null,
    created_at: '2026-09-02T00:00:00+00:00',
    suspended_reason: null,
  },
]

describe('listMembershipsByPousada', () => {
  beforeEach(() => {
    mocks.from.mockReset()
    mocks.rpc.mockReset()
    const membershipsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: memberRows, error: null }),
    }
    // A tabela `profiles` só devolve o próprio perfil (RLS) — não pode ser a fonte dos nomes.
    const profilesQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'user-owner', full_name: 'Dona da Pousada' }],
        error: null,
      }),
    }
    mocks.from.mockImplementation((table: string) =>
      table === 'memberships' ? membershipsQuery : profilesQuery,
    )
    mocks.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'list_membership_names') {
        return {
          data: [
            { user_id: 'user-owner', full_name: 'Dona da Pousada' },
            { user_id: 'user-recepcao', full_name: 'Recepção Teste' },
          ],
          error: null,
        }
      }
      if (fn === 'list_membership_emails') {
        return { data: [{ user_id: 'user-recepcao', email: 'recepcao@example.test' }], error: null }
      }
      return { data: null, error: null }
    })
  })

  it('mostra o nome de toda a equipe, não só o do próprio usuário', async () => {
    const members = await listMembershipsByPousada('pousada-1')
    expect(members.map((m) => m.fullName)).toEqual(['Dona da Pousada', 'Recepção Teste'])
    expect(members[1].email).toBe('recepcao@example.test')
    expect(mocks.rpc).toHaveBeenCalledWith('list_membership_names', { p_pousada_id: 'pousada-1' })
  })
})
