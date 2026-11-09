import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { cityQuery, getCityCenter } from './city-center'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('centro da cidade (mapa da região)', () => {
  it('monta a busca só com cidade e UF válidas', () => {
    expect(cityQuery(' Pirenópolis ', 'go')).toBe('Pirenópolis, GO, Brasil')
    expect(cityQuery('', 'GO')).toBeNull()
    expect(cityQuery('Pirenópolis', 'Goiás')).toBeNull()
  })

  it('devolve o ponto arredondado e guarda no cache de dados por 30 dias', async () => {
    const fetchMock = vi.fn(async () => json([{ lat: '-15.8523456789', lon: '-48.9591234567' }]))
    const point = await getCityCenter('Pirenópolis', 'GO', fetchMock as unknown as typeof fetch)
    expect(point?.lat).toBeCloseTo(-15.852346, 5)
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as { next?: { revalidate: number } }
    expect(init.next?.revalidate).toBe(60 * 60 * 24 * 30)
  })

  it('falha, vazio ou fora do Brasil viram "sem mapa"', async () => {
    const vazio = vi.fn(async () => json([]))
    expect(await getCityCenter('X', 'GO', vazio as unknown as typeof fetch)).toBeNull()
    const fora = vi.fn(async () => json([{ lat: '38.72', lon: '-9.14' }]))
    expect(await getCityCenter('Lisboa', 'GO', fora as unknown as typeof fetch)).toBeNull()
    const erro = vi.fn(async () => {
      throw new Error('rede')
    })
    expect(await getCityCenter('Franca', 'SP', erro as unknown as typeof fetch)).toBeNull()
  })
})
