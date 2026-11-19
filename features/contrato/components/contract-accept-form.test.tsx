// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ accept: vi.fn(), refresh: vi.fn() }))
vi.mock('../actions', () => ({ acceptContractAction: mocks.accept }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import { ContractAcceptForm } from './contract-accept-form'

const PROPS = {
  versionId: '11111111-1111-4111-8111-111111111111',
  bodySha256: 'a'.repeat(64),
  blocked: false,
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

describe('ContractAcceptForm', () => {
  it('sem marcar "li e aceito" não envia nada', () => {
    render(<ContractAcceptForm {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar o contrato' }))
    expect(mocks.accept).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Marque que você leu e aceita o contrato.')
  })

  it('com a caixa marcada envia a versão e o hash do texto que está na tela', async () => {
    mocks.accept.mockResolvedValue({ ok: true, data: { already: false } })
    render(<ContractAcceptForm {...PROPS} />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar o contrato' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.accept).toHaveBeenCalledWith({
      versionId: PROPS.versionId,
      bodySha256: PROPS.bodySha256,
      confirm: true,
    })
  })

  it('mostra a recusa do servidor e não recarrega', async () => {
    mocks.accept.mockResolvedValue({
      ok: false,
      error: 'Os dados da pousada mudaram desde que o contrato foi aberto.',
    })
    render(<ContractAcceptForm {...PROPS} />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar o contrato' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('dados da pousada mudaram'),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('com dados faltando a caixa e o botão ficam desligados', () => {
    render(<ContractAcceptForm {...PROPS} blocked />)
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Aceitar o contrato' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
