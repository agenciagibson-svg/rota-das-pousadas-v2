import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STEP_FAILED_MESSAGE, deleteMyAccount } from './account-deletion.service'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  anonymizeMyAccount: vi.fn(),
  softDeleteAuthUser: vi.fn(),
  signOut: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('./auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/account-deletion.repository', () => ({
  anonymizeMyAccount: mocks.anonymizeMyAccount,
  softDeleteAuthUser: mocks.softDeleteAuthUser,
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut: mocks.signOut } }),
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const USER = {
  id: '00000000-0000-0000-0000-000000000091',
  email: 'ana@example.test',
  name: 'Ana',
  platformRole: null,
  memberships: [],
}
const REFUSED =
  'Você tem uma reserva em andamento. Cancele ou aguarde o fim da estadia antes de excluir a conta.'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getCurrentUser.mockResolvedValue(USER)
  mocks.anonymizeMyAccount.mockResolvedValue('deleted')
  mocks.softDeleteAuthUser.mockResolvedValue(undefined)
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.reportError.mockResolvedValue(undefined)
})

describe('deleteMyAccount', () => {
  it('anonimiza, encerra no Auth com o id da sessão e limpa o cookie, nessa ordem', async () => {
    const order: string[] = []
    mocks.anonymizeMyAccount.mockImplementation(async () => {
      order.push('rpc')
      return 'deleted'
    })
    mocks.softDeleteAuthUser.mockImplementation(async () => {
      order.push('auth')
    })
    mocks.signOut.mockImplementation(async () => {
      order.push('signOut')
      return { error: null }
    })

    await deleteMyAccount(' ANA@example.test ')

    expect(order).toEqual(['rpc', 'auth', 'signOut'])
    expect(mocks.softDeleteAuthUser).toHaveBeenCalledWith(USER.id)
  })

  it('sem login, não faz nada', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    await expect(deleteMyAccount('ana@example.test')).rejects.toThrow('Faça login para continuar.')
    expect(mocks.anonymizeMyAccount).not.toHaveBeenCalled()
    expect(mocks.softDeleteAuthUser).not.toHaveBeenCalled()
  })

  it('e-mail de outra conta não exclui nada', async () => {
    await expect(deleteMyAccount('outra@example.test')).rejects.toThrow(
      'O e-mail digitado não é o da sua conta.',
    )
    expect(mocks.anonymizeMyAccount).not.toHaveBeenCalled()
    expect(mocks.softDeleteAuthUser).not.toHaveBeenCalled()
  })

  it('recusa do banco (reserva em andamento) sobe como está e não toca no Auth', async () => {
    mocks.anonymizeMyAccount.mockRejectedValue(new Error(REFUSED))
    await expect(deleteMyAccount('ana@example.test')).rejects.toThrow(REFUSED)
    expect(mocks.softDeleteAuthUser).not.toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('conta já anonimizada (nova tentativa) completa a etapa do Auth', async () => {
    mocks.anonymizeMyAccount.mockResolvedValue('already_deleted')
    await deleteMyAccount('ana@example.test')
    expect(mocks.softDeleteAuthUser).toHaveBeenCalledWith(USER.id)
  })

  it('falha no Auth avisa o monitoramento e pede para tentar de novo', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.softDeleteAuthUser.mockRejectedValue(new Error('auth.admin.deleteUser: 500'))
    await expect(deleteMyAccount('ana@example.test')).rejects.toThrow(AUTH_STEP_FAILED_MESSAGE)
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
      where: 'action:excluir-conta',
    })
    expect(mocks.signOut).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
