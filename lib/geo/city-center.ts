import 'server-only'
import { z } from 'zod'
import { isInsideBrazil, roundPoint, type GeoPoint } from './coordinates'
import { NOMINATIM_SEARCH_URL, NOMINATIM_USER_AGENT } from './nominatim'

/**
 * Centro da cidade para o mapa da REGIÃO na página da pousada que ainda não
 * marcou o ponto exato (0095). Não é o alfinete da pousada: a página mostra a
 * área da cidade, sem marcador, avisando que é aproximada.
 *
 * Política do Nominatim (operations.osmfoundation.org/policies/nominatim):
 * a resposta fica no cache de dados do Next por 30 dias, compartilhado entre
 * as instâncias — cada cidade vai ao serviço no máximo uma vez por mês. Sem
 * rota pública: só o servidor chama, com cidades que vêm do banco.
 *
 * Falha, demora ou resposta fora do Brasil → `null` (a página segue sem mapa).
 */

const REVALIDATE_SECONDS = 60 * 60 * 24 * 30
const TIMEOUT_MS = 3000

const response = z.array(z.object({ lat: z.string(), lon: z.string() }))

export function cityQuery(city: string, state: string): string | null {
  const c = city.trim().replace(/\s+/g, ' ')
  const s = state.trim().toUpperCase()
  if (c.length < 2 || c.length > 80 || !/^[A-Z]{2}$/.test(s)) return null
  return `${c}, ${s}, Brasil`
}

export async function getCityCenter(
  city: string,
  state: string,
  doFetch: typeof fetch = fetch,
): Promise<GeoPoint | null> {
  const q = cityQuery(city, state)
  if (!q) return null
  const url = new URL(NOMINATIM_SEARCH_URL)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('limit', '1')
  url.searchParams.set('accept-language', 'pt-BR')
  try {
    const res = await doFetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    } as RequestInit)
    if (!res.ok) return null
    const parsed = response.safeParse(await res.json())
    const first = parsed.success ? parsed.data[0] : undefined
    if (!first) return null
    const point = { lat: Number(first.lat), lng: Number(first.lon) }
    return isInsideBrazil(point) ? roundPoint(point) : null
  } catch {
    return null
  }
}
