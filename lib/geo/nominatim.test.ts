import { describe, expect, it, vi } from 'vitest'
import {
  MIN_INTERVAL_MS,
  NOMINATIM_USER_AGENT,
  buildQueries,
  createNominatimClient,
} from './nominatim'

// Endereços e respostas sintéticos — nenhuma chamada real ao Nominatim.
const ADDRESS = {
  address: 'Rua das Acácias, 100',
  cep: '37418000',
  city: 'São Tomé das Letras',
  state: 'mg',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Relógio virtual: `sleep` avança o tempo na hora, sem esperar de verdade. */
function fakeClock() {
  let t = 1_000_000
  return {
    now: () => t,
    sleep: vi.fn(async (ms: number) => {
      t += ms
    }),
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('buildQueries', () => {
  it('vai do mais preciso (endereço) ao mais amplo (cidade)', () => {
    expect(buildQueries(ADDRESS)).toEqual([
      { q: 'Rua das Acácias, 100, São Tomé das Letras, MG, Brasil', precision: 'endereco' },
      { q: '37418-000, São Tomé das Letras, MG, Brasil', precision: 'endereco' },
      { q: 'São Tomé das Letras, MG, Brasil', precision: 'cidade' },
    ])
  })

  it('sem endereço nem CEP, tenta só a cidade; sem cidade, nada', () => {
    expect(buildQueries({ ...ADDRESS, address: ' ', cep: '' })).toEqual([
      { q: 'São Tomé das Letras, MG, Brasil', precision: 'cidade' },
    ])
    expect(buildQueries({ address: 'Rua A', cep: '', city: '', state: '' })).toEqual([])
  })
})

describe('createNominatimClient', () => {
  it('pede ao Nominatim com User-Agent do app, país BR e formato json', async () => {
    const clock = fakeClock()
    const fetch = vi.fn(async (..._args: Parameters<typeof globalThis.fetch>) =>
      json([{ lat: '-21.7211', lon: '-44.9845', display_name: 'Rua das Acácias' }]),
    )
    const client = createNominatimClient({ fetch, now: clock.now, sleep: clock.sleep })

    const result = await client.geocode(ADDRESS)

    expect(result).toEqual({
      status: 'found',
      point: { lat: -21.7211, lng: -44.9845 },
      precision: 'endereco',
      label: 'Rua das Acácias',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]!
    const parsed = new URL(String(url))
    expect(parsed.origin + parsed.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(parsed.searchParams.get('countrycodes')).toBe('br')
    expect(parsed.searchParams.get('format')).toBe('jsonv2')
    expect(parsed.searchParams.get('limit')).toBe('1')
    expect(parsed.searchParams.get('q')).toBe(
      'Rua das Acácias, 100, São Tomé das Letras, MG, Brasil',
    )
    expect(new Headers(init?.headers).get('User-Agent')).toBe(NOMINATIM_USER_AGENT)
    expect(NOMINATIM_USER_AGENT).toMatch(/^RotaDasPousadas\/[\d.]+ \(https:\/\/.+; .+@.+\)$/)
  })

  it('endereço não achado: cai para o CEP e depois para a cidade, avisando a precisão', async () => {
    const clock = fakeClock()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ lat: '-21.72', lon: '-44.98' }]))
    const client = createNominatimClient({ fetch, now: clock.now, sleep: clock.sleep })

    const result = await client.geocode(ADDRESS)

    expect(result).toMatchObject({ status: 'found', precision: 'cidade' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('uma requisição por vez, com pelo menos 1,1 s entre elas — mesmo com chamadas simultâneas', async () => {
    const clock = fakeClock()
    const startedAt: number[] = []
    let inFlight = 0
    let maxInFlight = 0
    const fetch = vi.fn(async () => {
      startedAt.push(clock.now())
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      clock.advance(300) // tempo de resposta do serviço
      inFlight -= 1
      return json([{ lat: '-21.72', lon: '-44.98' }])
    })
    const client = createNominatimClient({ fetch, now: clock.now, sleep: clock.sleep })

    await Promise.all([
      client.geocode(ADDRESS),
      client.geocode({ ...ADDRESS, address: 'Rua B, 2' }),
      client.geocode({ ...ADDRESS, address: 'Rua C, 3' }),
    ])

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(maxInFlight).toBe(1)
    for (let i = 1; i < startedAt.length; i++) {
      expect(startedAt[i]! - startedAt[i - 1]!).toBeGreaterThanOrEqual(MIN_INTERVAL_MS)
    }
  })

  it('guarda o resultado: o mesmo endereço não vai de novo ao serviço', async () => {
    const clock = fakeClock()
    const fetch = vi.fn(async () => json([{ lat: '-21.72', lon: '-44.98' }]))
    const client = createNominatimClient({ fetch, now: clock.now, sleep: clock.sleep })

    await client.geocode(ADDRESS)
    await client.geocode(ADDRESS)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('serviço fora do ar ou resposta estranha: "unavailable" (a pessoa marca à mão)', async () => {
    const clock = fakeClock()
    const down = createNominatimClient({
      fetch: vi.fn(async () => json({ error: 'x' }, 503)),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(await down.geocode(ADDRESS)).toEqual({ status: 'unavailable' })

    const weird = createNominatimClient({
      fetch: vi.fn(async () => json({ not: 'an array' })),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(await weird.geocode(ADDRESS)).toEqual({ status: 'unavailable' })

    const network = createNominatimClient({
      fetch: vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(await network.geocode(ADDRESS)).toEqual({ status: 'unavailable' })
  })

  it('resultado fora do Brasil ou com número inválido não vira ponto', async () => {
    const clock = fakeClock()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([{ lat: '38.72', lon: '-9.14' }]))
      .mockResolvedValueOnce(json([{ lat: 'abc', lon: '-44' }]))
      .mockResolvedValueOnce(json([]))
    const client = createNominatimClient({ fetch, now: clock.now, sleep: clock.sleep })

    expect(await client.geocode(ADDRESS)).toEqual({ status: 'not_found' })
  })

  it('sem cidade cadastrada, nem chama o serviço', async () => {
    const fetch = vi.fn()
    const client = createNominatimClient({ fetch })
    expect(await client.geocode({ address: '', cep: '', city: '', state: '' })).toEqual({
      status: 'not_found',
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
