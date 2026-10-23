import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Supabase configurado e ninguém logado: as rotas de retorno do login
// (/auth/callback do Google e /auth/confirm do link do e-mail) precisam
// passar sem cair no redirecionamento para /login — senão a pessoa nunca
// conseguiria entrar por elas.
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => true,
  publicEnv: {
    siteUrl: 'https://rotadaspousadas.com.br',
    supabaseUrl: 'https://proj.supabase.co',
    supabaseAnonKey: 'anon',
  },
}))
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: async () => ({ response: NextResponse.next(), user: null }),
}))

describe('proxy: rotas de retorno do login', () => {
  it.each([
    '/auth/callback?code=abc&next=%2Fpousada%2Fx%2Freservar',
    '/auth/confirm?token_hash=abc',
  ])('%s passa sem exigir login', async (path) => {
    const { default: proxy } = await import('./proxy')
    const response = await proxy(new NextRequest(`https://rotadaspousadas.com.br${path}`))

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('content-security-policy')).toContain("form-action 'self'")
  })

  it('área logada continua mandando para o login com o destino', async () => {
    const { default: proxy } = await import('./proxy')
    const response = await proxy(new NextRequest('https://rotadaspousadas.com.br/minhas-reservas'))

    expect(response.headers.get('location')).toBe(
      'https://rotadaspousadas.com.br/login?next=%2Fminhas-reservas',
    )
  })
})
