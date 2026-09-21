import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitQuoteRequest } from './bio.service'

const mocks = vi.hoisted(() => ({
  createQuoteRequestRpc: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@/repositories/bio.repository', () => ({
  createQuoteRequestRpc: mocks.createQuoteRequestRpc,
  getLinkReportRpc: vi.fn(),
  listQuoteRequestsByPousada: vi.fn(),
  purgeStaleQuoteRequestsRpc: vi.fn(),
  setQuoteRequestStatusRpc: vi.fn(),
}))
vi.mock('@/lib/turnstile', () => ({ verifyTurnstileToken: mocks.verifyTurnstileToken }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.10' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const INPUT = {
  pousadaId: 'pousada-1',
  name: 'Maria',
  phone: '(34) 99999-0000',
  email: '',
  checkin: '',
  checkout: '',
  adults: 2,
  children: 0,
  pets: false,
  occasion: '',
  message: '',
  consent: true,
  turnstileToken: 'token-do-widget',
}

describe('submitQuoteRequest — porta do Turnstile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createQuoteRequestRpc.mockResolvedValue({ id: 'quote-1' })
  })

  it('chama a RPC quando o Turnstile confirma que é humano', async () => {
    mocks.verifyTurnstileToken.mockResolvedValue(true)

    const result = await submitQuoteRequest(INPUT)

    expect(result).toEqual({ id: 'quote-1' })
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith('token-do-widget', '203.0.113.10')
    expect(mocks.createQuoteRequestRpc).toHaveBeenCalledTimes(1)
  })

  it('barra ANTES de chamar a RPC quando o Turnstile rejeita', async () => {
    mocks.verifyTurnstileToken.mockResolvedValue(false)

    await expect(submitQuoteRequest(INPUT)).rejects.toThrow(
      'Não foi possível confirmar que você não é um robô. Atualize a página e tente de novo.',
    )
    expect(mocks.createQuoteRequestRpc).not.toHaveBeenCalled()
  })
})
