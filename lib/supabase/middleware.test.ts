import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth }),
}))
vi.mock('@/lib/env', () => ({
  publicEnv: { supabaseUrl: 'https://exemplo.supabase.co', supabaseAnonKey: 'anon' },
}))

import { updateSession } from './middleware'

const request = () => new NextRequest('https://rotadaspousadas.com.br/minhas-reservas')

describe('updateSession', () => {
  beforeEach(() => {
    auth.getClaims.mockReset()
    auth.getUser.mockReset()
  })

  it('confere o login pela assinatura do token, sem chamar o Auth a cada página', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'u-1' } }, error: null })
    const { user } = await updateSession(request())
    expect(user).toEqual({ id: 'u-1' })
    expect(auth.getUser).not.toHaveBeenCalled()
  })

  it('sem sessão ou token inválido: ninguém logado', async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: new Error('Invalid JWT signature') })
    await expect(updateSession(request())).resolves.toMatchObject({ user: null })
  })

  it('token sem `sub` não conta como login', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { role: 'anon' } }, error: null })
    await expect(updateSession(request())).resolves.toMatchObject({ user: null })
  })

  it('falha inesperada não derruba a página: segue como deslogado', async () => {
    auth.getClaims.mockRejectedValue(new Error('rede'))
    await expect(updateSession(request())).resolves.toMatchObject({ user: null })
  })
})
