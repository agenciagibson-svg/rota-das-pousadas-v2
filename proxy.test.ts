import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Modo demonstração: sem credenciais do Supabase o app usa os dados de
// exemplo. O proxy precisa repassar o nonce da CSP na requisição também
// nesse modo; sem isso o Next não carimba o nonce nos próprios scripts, a
// CSP os bloqueia e a home fica parada em "Preparando sua rota…".
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => false,
  publicEnv: { siteUrl: 'http://localhost:3000', supabaseUrl: '', supabaseAnonKey: '' },
}))

describe('proxy no modo demonstração', () => {
  it('repassa na requisição o mesmo nonce da CSP da resposta', async () => {
    const { default: proxy } = await import('./proxy')
    const response = await proxy(new NextRequest('http://localhost:3000/'))

    const csp = response.headers.get('content-security-policy') ?? ''
    const nonce = csp.match(/'nonce-([a-f0-9]+)'/)?.[1]
    expect(nonce).toBeTruthy()

    // NextResponse.next({ request: { headers } }) expõe os cabeçalhos
    // sobrescritos da requisição com o prefixo x-middleware-request-.
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp)
  })
})
