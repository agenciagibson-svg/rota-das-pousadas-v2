import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstileToken } from './turnstile'

const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY

afterEach(() => {
  vi.unstubAllGlobals()
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET
  vi.unstubAllEnvs()
})

describe('verifyTurnstileToken', () => {
  it('recusa em produção quando TURNSTILE_SECRET_KEY não está configurada', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    vi.stubEnv('NODE_ENV', 'production')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(verifyTurnstileToken('qualquer', null)).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('preview com banco próprio pode desligar de propósito com TURNSTILE_DISABLED=true', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TURNSTILE_DISABLED', 'true')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(verifyTurnstileToken('', null)).resolves.toBe(true)
    warn.mockRestore()
  })

  it('fora de produção, deixa passar sem checar quando TURNSTILE_SECRET_KEY não está configurada', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(verifyTurnstileToken('', null)).resolves.toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejeita token vazio quando a chave está configurada, sem nem chamar a API', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-de-teste'
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(verifyTurnstileToken('', null)).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aceita quando a API do Cloudflare confirma sucesso', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-de-teste'
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal('fetch', fetch)

    await expect(verifyTurnstileToken('token-valido', '203.0.113.10')).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('rejeita quando a API do Cloudflare responde sucesso falso', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-de-teste'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))),
    )

    await expect(verifyTurnstileToken('token-invalido', null)).resolves.toBe(false)
  })

  it('rejeita (fecha em segurança) se a chamada ao Cloudflare falhar', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-de-teste'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede fora do ar')))

    await expect(verifyTurnstileToken('token-qualquer', null)).resolves.toBe(false)
  })
})
