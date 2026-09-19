import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchFeedText } from './sync.service'

vi.mock('@/repositories/channels.repository', () => ({
  listFeedsToImport: vi.fn(),
  applySyncRpc: vi.fn(),
}))

/**
 * Testamos só com IP literal na URL (nunca hostname) de propósito: resolver
 * hostname exige mockar `node:dns/promises`, e isso se mostrou não confiável
 * neste projeto (DNS real do ambiente responde por trás do mock em alguns
 * setups Windows/Node, por exemplo quando o roteador redireciona domínio
 * inexistente para um IP próprio). Com IP literal a checagem de bloqueio
 * roda no mesmo código (é o `isIP()` que evita a chamada de DNS), só que de
 * forma determinística e sem depender do ambiente.
 */
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchFeedText — bloqueio de SSRF', () => {
  it('recusa IP privado literal na própria URL, sem nem chamar fetch', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(fetchFeedText('http://127.0.0.1:8080/feed.ics')).rejects.toThrow(
      'Endereço do calendário não é permitido.',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('recusa o range de metadados de nuvem (169.254.169.254)', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(fetchFeedText('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      'Endereço do calendário não é permitido.',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('busca normalmente um IP público literal', async () => {
    const response = new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR', {
      status: 200,
      headers: { 'content-length': '32' },
    })
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)

    const text = await fetchFeedText('https://203.0.113.10/feed.ics')
    expect(text).toContain('VCALENDAR')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('recusa quando o redirecionamento aponta para um IP privado', async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    })
    const fetch = vi.fn().mockResolvedValue(redirectResponse)
    vi.stubGlobal('fetch', fetch)

    await expect(fetchFeedText('https://203.0.113.10/feed.ics')).rejects.toThrow(
      'Endereço do calendário não é permitido.',
    )
    // Só o primeiro salto foi buscado — o redirecionamento nunca chegou a ser seguido.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('recusa protocolo diferente de http/https', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(fetchFeedText('file:///etc/passwd')).rejects.toThrow(
      'URL do calendário deve ser http ou https.',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
