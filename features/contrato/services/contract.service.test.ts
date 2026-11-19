import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  getCurrentUser: vi.fn(),
  sendEmail: vi.fn(),
  acceptContractRpc: vi.fn(),
  getAcceptedContractRpc: vi.fn(),
  getContractStateRpc: vi.fn(),
  listContractVersionsRpc: vi.fn(),
  publishContractVersionRpc: vi.fn(),
  saveContractDraftRpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-capability', () => ({ requireCapability: mocks.requireCapability }))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/email/mailer', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/repositories/contracts.repository', () => ({
  acceptContractRpc: mocks.acceptContractRpc,
  getAcceptedContractRpc: mocks.getAcceptedContractRpc,
  getContractStateRpc: mocks.getContractStateRpc,
  listContractVersionsRpc: mocks.listContractVersionsRpc,
  publishContractVersionRpc: mocks.publishContractVersionRpc,
  saveContractDraftRpc: mocks.saveContractDraftRpc,
}))

import {
  acceptContract,
  getContractSetupInfo,
  getContractState,
  listContractVersions,
  publishContractVersion,
  saveContractDraft,
} from './contract.service'

const POUSADA = '10000000-0000-4000-8000-000000000001'
const INPUT = { versionId: '11111111-1111-4111-8111-111111111111', bodySha256: 'a'.repeat(64) }
const REQUEST = { ip: '203.0.113.7', userAgent: 'Navegador de teste' }
const ACCEPTED = {
  acceptedAt: '2026-12-02T12:00:00Z',
  acceptedByName: 'Pessoa de Teste',
  acceptedByEmail: 'pessoa@example.test',
  versionCode: 'teste-v1',
  versionTitle: 'Contrato de teste',
  sha256: 'a'.repeat(64),
  body: '# Contrato\n\nTexto de teste.',
  pousadaName: 'Pousada Exemplo',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mocks.requireCapability.mockResolvedValue({ pousadaId: POUSADA, role: 'proprietario' })
  mocks.sendEmail.mockResolvedValue(true)
  mocks.getAcceptedContractRpc.mockResolvedValue(ACCEPTED)
})

describe('acceptContract', () => {
  it('exige a permissão de aceite e usa a pousada ativa, nunca um id vindo da tela', async () => {
    mocks.acceptContractRpc.mockResolvedValue({
      acceptedAt: ACCEPTED.acceptedAt,
      versionCode: 'teste-v1',
      already: false,
    })
    await acceptContract(INPUT, REQUEST)
    expect(mocks.requireCapability).toHaveBeenCalledWith('contract:accept')
    expect(mocks.acceptContractRpc).toHaveBeenCalledWith({
      pousadaId: POUSADA,
      versionId: INPUT.versionId,
      bodySha256: INPUT.bodySha256,
      ip: REQUEST.ip,
      userAgent: REQUEST.userAgent,
    })
  })

  it('quem não é proprietário nem chega ao banco', async () => {
    mocks.requireCapability.mockRejectedValue(new Error('Você não tem permissão para esta ação.'))
    await expect(acceptContract(INPUT, REQUEST)).rejects.toThrow('permissão')
    expect(mocks.acceptContractRpc).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('manda o contrato aceito para o proprietário e para a caixa da Rota quando configurada', async () => {
    vi.stubEnv('CONTRACTS_NOTIFY_EMAIL', 'contratos@example.test')
    mocks.acceptContractRpc.mockResolvedValue({
      acceptedAt: ACCEPTED.acceptedAt,
      versionCode: 'teste-v1',
      already: false,
    })
    await acceptContract(INPUT, REQUEST)
    const recipients = mocks.sendEmail.mock.calls.map(([params]) => params.to)
    expect(recipients).toEqual(['pessoa@example.test', 'contratos@example.test'])
    const [owner] = mocks.sendEmail.mock.calls[0]
    expect(owner.subject).toBe('Contrato aceito — Pousada Exemplo')
    expect(owner.text).toContain('Texto de teste.')
    expect(owner.text).toContain('a'.repeat(64))
  })

  it('sem a variável, a cópia da Rota vai para o e-mail de contato', async () => {
    mocks.acceptContractRpc.mockResolvedValue({
      acceptedAt: ACCEPTED.acceptedAt,
      versionCode: 'teste-v1',
      already: false,
    })
    await acceptContract(INPUT, REQUEST)
    const recipients = mocks.sendEmail.mock.calls.map(([params]) => params.to)
    expect(recipients).toEqual(['pessoa@example.test', 'contatorotadaspousadas@gmail.com'])
  })

  it('quem aceita com o próprio e-mail da Rota não recebe duas vezes', async () => {
    vi.stubEnv('CONTRACTS_NOTIFY_EMAIL', 'Pessoa@Example.test')
    mocks.acceptContractRpc.mockResolvedValue({
      acceptedAt: ACCEPTED.acceptedAt,
      versionCode: 'teste-v1',
      already: false,
    })
    await acceptContract(INPUT, REQUEST)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('aceite repetido não manda e-mail de novo', async () => {
    mocks.acceptContractRpc.mockResolvedValue({
      acceptedAt: ACCEPTED.acceptedAt,
      versionCode: 'teste-v1',
      already: true,
    })
    const result = await acceptContract(INPUT, REQUEST)
    expect(result.already).toBe(true)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('falha no e-mail não desfaz o aceite', async () => {
    mocks.acceptContractRpc.mockResolvedValue({
      acceptedAt: ACCEPTED.acceptedAt,
      versionCode: 'teste-v1',
      already: false,
    })
    mocks.sendEmail.mockRejectedValue(new Error('SMTP fora do ar'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(acceptContract(INPUT, REQUEST)).resolves.toMatchObject({ already: false })
    spy.mockRestore()
  })

  it('recusa do banco chega como está (ex.: dados mudaram)', async () => {
    mocks.acceptContractRpc.mockRejectedValue(
      new Error('Os dados da pousada mudaram desde que o contrato foi aberto.'),
    )
    await expect(acceptContract(INPUT, REQUEST)).rejects.toThrow('dados da pousada mudaram')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})

describe('leitura', () => {
  it('a situação pede `contract:view` na pousada ativa', async () => {
    mocks.getContractStateRpc.mockResolvedValue({ active: true, acceptedCurrent: false })
    await getContractState()
    expect(mocks.requireCapability).toHaveBeenCalledWith('contract:view')
    expect(mocks.getContractStateRpc).toHaveBeenCalledWith(POUSADA)
  })

  it('configuração guiada: erro de leitura vira `null`, não derruba o painel', async () => {
    mocks.getContractStateRpc.mockRejectedValue(new Error('function does not exist'))
    await expect(getContractSetupInfo()).resolves.toBeNull()
    mocks.getContractStateRpc.mockResolvedValue({ active: true, acceptedCurrent: true })
    await expect(getContractSetupInfo()).resolves.toEqual({ active: true, accepted: true })
  })
})

describe('admin', () => {
  const DRAFT = {
    code: '2026-12-v1',
    title: 'Contrato',
    bodyTemplate: 'x'.repeat(200),
    requiresReaccept: true,
  }

  it('só o master lista, grava e publica versão', async () => {
    for (const user of [
      null,
      { id: 'u', platformRole: null },
      { id: 'u', platformRole: 'comercial' },
    ]) {
      mocks.getCurrentUser.mockResolvedValue(user)
      await expect(listContractVersions()).rejects.toThrow('Só o master')
      await expect(saveContractDraft(DRAFT)).rejects.toThrow('Só o master')
      await expect(publishContractVersion('2026-12-v1')).rejects.toThrow('Só o master')
    }
    expect(mocks.listContractVersionsRpc).not.toHaveBeenCalled()
    expect(mocks.saveContractDraftRpc).not.toHaveBeenCalled()
    expect(mocks.publishContractVersionRpc).not.toHaveBeenCalled()
  })

  it('master grava o rascunho e publica', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'm', platformRole: 'master' })
    mocks.saveContractDraftRpc.mockResolvedValue('id-1')
    mocks.publishContractVersionRpc.mockResolvedValue('id-1')
    await expect(saveContractDraft(DRAFT)).resolves.toEqual({ id: 'id-1' })
    await expect(publishContractVersion('2026-12-v1')).resolves.toEqual({ id: 'id-1' })
    expect(mocks.saveContractDraftRpc).toHaveBeenCalledWith(DRAFT)
    expect(mocks.publishContractVersionRpc).toHaveBeenCalledWith('2026-12-v1')
  })
})
