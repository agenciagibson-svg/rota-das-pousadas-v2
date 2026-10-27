import 'server-only'
import { z } from 'zod'
import { LEGAL } from '@/lib/legal'
import { isInsideBrazil, roundPoint, type GeoPoint } from './coordinates'

/**
 * Geocodificação (endereço → ponto no mapa) pelo Nominatim, o buscador do
 * OpenStreetMap. Só roda no SERVIDOR, chamado pelo painel quando o dono
 * clica em "Buscar pelo endereço".
 *
 * Política de uso do serviço público (operations.osmfoundation.org/policies/nominatim):
 *  - User-Agent que identifique o app, com contato (abaixo);
 *  - no máximo 1 requisição por segundo, sem rajadas: as chamadas deste
 *    processo entram numa fila e saem uma por vez, com intervalo mínimo;
 *  - guardar os resultados: cache em memória por 24 h (endereço igual não
 *    vai de novo ao serviço);
 *  - nada de autocompletar a cada tecla: só o clique no botão dispara.
 *
 * Limite conhecido: a fila e o cache são por instância do servidor (na
 * Vercel, cada função tem a sua). Com o volume do painel (um dono marcando a
 * própria pousada de vez em quando) isso fica muito abaixo de 1/s; se um dia
 * houver geocodificação em massa, ela precisa de fila no banco ou de um
 * provedor pago.
 */

export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
export const NOMINATIM_USER_AGENT = `RotaDasPousadas/1.0 (https://${LEGAL.site}; ${LEGAL.contactEmail})`

/** Intervalo mínimo entre duas chamadas ao serviço (política: 1/s; folga de 100 ms). */
export const MIN_INTERVAL_MS = 1100
const TIMEOUT_MS = 8000
/** Mais que isso na fila e a pessoa recebe "tente de novo" em vez de esperar muito. */
const MAX_QUEUE = 5
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 200

export type GeocodeAddress = {
  address: string
  cep: string
  city: string
  state: string
}

export type GeocodePrecision = 'endereco' | 'cidade'

export type GeocodeResult =
  | { status: 'found'; point: GeoPoint; precision: GeocodePrecision; label: string }
  | { status: 'not_found' }
  | { status: 'unavailable' }

const nominatimResponse = z.array(
  z.object({
    lat: z.string(),
    lon: z.string(),
    display_name: z.string().optional(),
  }),
)

type Deps = {
  fetch: typeof fetch
  now: () => number
  sleep: (ms: number) => Promise<void>
}

const defaultDeps: Deps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** Consultas tentadas, da mais precisa para a mais ampla. */
export function buildQueries(input: GeocodeAddress): { q: string; precision: GeocodePrecision }[] {
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
  const address = clean(input.address)
  const city = clean(input.city)
  const state = clean(input.state).toUpperCase()
  const cep = input.cep.replace(/\D/g, '')
  const cepLabel = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : ''
  const place = [city, state].filter(Boolean).join(', ')

  const queries: { q: string; precision: GeocodePrecision }[] = []
  if (address && place) queries.push({ q: `${address}, ${place}, Brasil`, precision: 'endereco' })
  if (cepLabel && place) queries.push({ q: `${cepLabel}, ${place}, Brasil`, precision: 'endereco' })
  if (place) queries.push({ q: `${place}, Brasil`, precision: 'cidade' })
  return queries
}

/**
 * Fila serializada do processo: cada chamada espera a anterior terminar e o
 * intervalo mínimo passar. Exportada só para os testes trocarem o relógio.
 */
export function createNominatimClient(deps: Partial<Deps> = {}) {
  const { fetch: doFetch, now, sleep } = { ...defaultDeps, ...deps }
  let tail: Promise<unknown> = Promise.resolve()
  let pending = 0
  let lastRequestAt = -Infinity
  const cache = new Map<string, { at: number; value: GeoPoint | null; label: string }>()

  async function request(q: string): Promise<{ point: GeoPoint | null; label: string }> {
    const wait = lastRequestAt + MIN_INTERVAL_MS - now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = now()

    const url = new URL(NOMINATIM_SEARCH_URL)
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('limit', '1')
    url.searchParams.set('accept-language', 'pt-BR')

    const res = await doFetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`)
    const parsed = nominatimResponse.safeParse(await res.json())
    if (!parsed.success) throw new Error('Resposta inesperada do Nominatim')
    const first = parsed.data[0]
    if (!first) return { point: null, label: '' }
    const point = { lat: Number(first.lat), lng: Number(first.lon) }
    // `countrycodes=br` já filtra; a checagem garante que nada fora da caixa
    // (ou um número inválido) chegue ao formulário.
    if (!isInsideBrazil(point)) return { point: null, label: '' }
    return { point: roundPoint(point), label: first.display_name ?? '' }
  }

  function cached(q: string) {
    const hit = cache.get(q)
    if (!hit) return undefined
    if (now() - hit.at > CACHE_TTL_MS) {
      cache.delete(q)
      return undefined
    }
    return hit
  }

  function remember(q: string, value: GeoPoint | null, label: string) {
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(q, { at: now(), value, label })
  }

  /** Uma consulta, respeitando cache e fila. */
  function search(q: string): Promise<{ point: GeoPoint | null; label: string }> {
    const hit = cached(q)
    if (hit) return Promise.resolve({ point: hit.value, label: hit.label })
    if (pending >= MAX_QUEUE) return Promise.reject(new Error('Fila do Nominatim cheia'))
    pending += 1
    const run = tail.then(() => request(q))
    tail = run.catch(() => undefined)
    return run
      .then((result) => {
        remember(q, result.point, result.label)
        return result
      })
      .finally(() => {
        pending -= 1
      })
  }

  async function geocode(input: GeocodeAddress): Promise<GeocodeResult> {
    const queries = buildQueries(input)
    if (queries.length === 0) return { status: 'not_found' }
    try {
      for (const { q, precision } of queries) {
        const { point, label } = await search(q)
        if (point) return { status: 'found', point, precision, label }
      }
      return { status: 'not_found' }
    } catch {
      return { status: 'unavailable' }
    }
  }

  return { geocode }
}

const client = createNominatimClient()

/** Endereço cadastrado → ponto no mapa (servidor). */
export function geocodeAddress(input: GeocodeAddress): Promise<GeocodeResult> {
  return client.geocode(input)
}
