import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ exchangeAuthCode: vi.fn() }))

vi.mock('@/features/auth/services/passwordless.service', () => ({
  exchangeAuthCode: mocks.exchangeAuthCode,
  redirectAfterSignIn: (next: string | null) => next ?? '/minhas-reservas',
}))

const ORIGIN = 'https://rotadaspousadas.com.br'
const BOOKING = '/pousada/serra-azul/reservar?checkin=2026-11-10&guests=2'

async function callback(query: string) {
  const { GET } = await import('./route')
  const response = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`))
  return { status: response.status, location: response.headers.get('location') }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.exchangeAuthCode.mockResolvedValue(true)
})

describe('/auth/callback (Google e link padrão do e-mail)', () => {
  it('troca o code pela sessão e volta para a reserva', async () => {
    const { status, location } = await callback(`?code=abc123&next=${encodeURIComponent(BOOKING)}`)

    expect(mocks.exchangeAuthCode).toHaveBeenCalledWith('abc123')
    expect(status).toBe(307)
    expect(location).toBe(`${ORIGIN}${BOOKING}`)
  })

  it('sem next vai para Minhas reservas', async () => {
    const { location } = await callback('?code=abc123')

    expect(location).toBe(`${ORIGIN}/minhas-reservas`)
  })

  it.each(['//evil.example', 'https://evil.example', '/\\evil.example', '%2F%2Fevil.example'])(
    'nunca redireciona para fora do site: next=%s',
    async (next) => {
      const { location } = await callback(`?code=abc123&next=${next}`)

      expect(new URL(location ?? '').origin).toBe(ORIGIN)
      expect(location).toBe(`${ORIGIN}/minhas-reservas`)
    },
  )

  it('code inválido (outro navegador, vencido): volta ao login com aviso e o mesmo destino', async () => {
    mocks.exchangeAuthCode.mockResolvedValue(false)

    const { location } = await callback(`?code=abc123&next=${encodeURIComponent(BOOKING)}`)

    expect(location).toBe(`${ORIGIN}/login?next=${encodeURIComponent(BOOKING)}&erro=retorno`)
  })

  it('Google cancelado (?error=access_denied, sem code): login com aviso, sem tentar trocar', async () => {
    const { location } = await callback('?error=access_denied&error_description=denied')

    expect(mocks.exchangeAuthCode).not.toHaveBeenCalled()
    expect(location).toBe(`${ORIGIN}/login?erro=retorno`)
  })
})
