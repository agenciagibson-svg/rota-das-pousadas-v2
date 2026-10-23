import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Com Supabase configurado e sem sessão: rota protegida manda para o login
// levando caminho E query no `next` (o link do e-mail de avaliação traz a nota).
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => true,
  publicEnv: { siteUrl: 'http://localhost:3000', supabaseUrl: '', supabaseAnonKey: '' },
}))
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: async () => ({ response: NextResponse.next(), user: null }),
}))

describe('proxy sem sessão em rota protegida', () => {
  it('leva a nota do e-mail de avaliação até a volta do login', async () => {
    const { default: proxy } = await import('./proxy')
    const id = '30000000-0000-0000-0000-000000008901'
    const response = await proxy(
      new NextRequest(`http://localhost:3000/minhas-reservas/${id}/avaliar?nota=5`),
    )

    const location = new URL(response.headers.get('location') ?? '')
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('next')).toBe(`/minhas-reservas/${id}/avaliar?nota=5`)
    expect(location.searchParams.get('nota')).toBeNull()
  })

  it('sem query, o next é só o caminho', async () => {
    const { default: proxy } = await import('./proxy')
    const response = await proxy(new NextRequest('http://localhost:3000/minhas-reservas'))

    const location = new URL(response.headers.get('location') ?? '')
    expect(location.searchParams.get('next')).toBe('/minhas-reservas')
  })
})
