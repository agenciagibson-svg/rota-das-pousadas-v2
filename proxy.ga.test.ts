import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Com ID do GA4 configurado, a CSP libera o script do Tag Manager e os envios
// para o Analytics. Sem ID (proxy.test.ts), nada do Google entra.
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => false,
  publicEnv: {
    siteUrl: 'http://localhost:3000',
    supabaseUrl: '',
    supabaseAnonKey: '',
    gaMeasurementId: 'G-TESTE123',
  },
}))

describe('CSP com Google Analytics', () => {
  it('libera o gtag.js e os envios do GA4', async () => {
    const { default: proxy } = await import('./proxy')
    const response = await proxy(new NextRequest('http://localhost:3000/'))
    const csp = response.headers.get('content-security-policy') ?? ''
    const script = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
    const connect = csp.split(';').find((d) => d.trim().startsWith('connect-src')) ?? ''
    expect(script).toContain('https://www.googletagmanager.com')
    expect(script).not.toContain("'unsafe-inline'")
    expect(connect).toContain('https://*.google-analytics.com')
    expect(connect).toContain('https://*.analytics.google.com')
  })
})
