import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anonymizeMyAccount, softDeleteAuthUser } from './account-deletion.repository'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceRoleClient: () => ({ auth: { admin: { deleteUser: mocks.deleteUser } } }),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('anonymizeMyAccount', () => {
  it('chama a RPC sem argumentos (sempre sobre a sessão)', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'deleted' }, error: null })
    await expect(anonymizeMyAccount()).resolves.toBe('deleted')
    expect(mocks.rpc).toHaveBeenCalledWith('delete_my_account')
  })

  it('repassa a mensagem de recusa do banco', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Transfira ou encerre sua pousada antes de excluir a conta. Fale com o suporte.',
      },
    })
    await expect(anonymizeMyAccount()).rejects.toThrow('Transfira ou encerre sua pousada')
  })

  it('resposta estranha não é tratada como sucesso', async () => {
    mocks.rpc.mockResolvedValue({ data: {}, error: null })
    await expect(anonymizeMyAccount()).rejects.toThrow('resposta inesperada')
  })
})

describe('softDeleteAuthUser', () => {
  it('exclui em modo soft (preserva a linha referenciada pela pousada)', async () => {
    mocks.deleteUser.mockResolvedValue({ data: {}, error: null })
    await softDeleteAuthUser('u1')
    expect(mocks.deleteUser).toHaveBeenCalledWith('u1', true)
  })

  it('erro do Auth vira exceção', async () => {
    mocks.deleteUser.mockResolvedValue({ data: null, error: { message: 'User not found' } })
    await expect(softDeleteAuthUser('u1')).rejects.toThrow('User not found')
  })
})
