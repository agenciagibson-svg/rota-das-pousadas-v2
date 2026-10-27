import { z } from 'zod'
import type { GeoPoint } from '@/types'

export type { GeoPoint }

/**
 * Coordenadas da pousada (h8 — mapa na busca e na página da pousada).
 *
 * Funções puras, sem `server-only`: o painel (marcar o ponto), a página
 * pública e a busca usam as mesmas regras. Ordem dos campos: `lat`/`lng`
 * (graus decimais, WGS 84 — o que o OpenStreetMap e o GPS usam). O MapLibre
 * espera `[lng, lat]`; a conversão fica em `toLngLat`.
 */
/**
 * Caixa do Brasil com folga (~1,5°) em volta dos extremos: Monte Caburaí
 * (5,27° N), Arroio Chuí (33,75° S), Serra do Divisor (73,99° O) e ilhas de
 * Trindade e Martim Vaz (28,85° O). A mesma caixa está na constraint
 * `pousadas_coordenadas_brasil` da migration 0095 — `coordinates.test.ts`
 * confere que as duas não se separam.
 */
export const BRAZIL_BOUNDS = {
  minLat: -35.5,
  maxLat: 7,
  minLng: -75.5,
  maxLng: -27.5,
} as const

/** Centro aproximado do Brasil, para o mapa do painel quando ainda não há ponto. */
export const BRAZIL_CENTER: GeoPoint = { lat: -14.5, lng: -51.5 }

/** Casas decimais gravadas: 6 = ~11 cm, mais do que o necessário e o que cabe em numeric(9,6). */
export const COORDINATE_DECIMALS = 6

export function isInsideBrazil(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= BRAZIL_BOUNDS.minLat &&
    point.lat <= BRAZIL_BOUNDS.maxLat &&
    point.lng >= BRAZIL_BOUNDS.minLng &&
    point.lng <= BRAZIL_BOUNDS.maxLng
  )
}

export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS
  return Math.round(value * factor) / factor
}

export function roundPoint(point: GeoPoint): GeoPoint {
  return { lat: roundCoordinate(point.lat), lng: roundCoordinate(point.lng) }
}

/**
 * Ponto vindo do formulário/Server Action. Sem `.transform()` (ver
 * `lib/validation/br.ts`): o arredondamento acontece no service.
 */
export const geoPointSchema = z
  .object({
    lat: z.number({ invalid_type_error: 'Latitude inválida.' }).finite('Latitude inválida.'),
    lng: z.number({ invalid_type_error: 'Longitude inválida.' }).finite('Longitude inválida.'),
  })
  .strict()
  .refine(isInsideBrazil, 'O ponto precisa ficar dentro do Brasil.')

/**
 * Lê o par de colunas do banco (`numeric` chega como número ou texto,
 * conforme o caminho). Qualquer coisa incompleta, inválida ou fora da caixa
 * vira `null` — a tela então simplesmente não mostra mapa.
 */
export function pointFromColumns(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): GeoPoint | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null
  if (lat === '' || lng === '') return null
  const point = { lat: Number(lat), lng: Number(lng) }
  return isInsideBrazil(point) ? point : null
}

/** `[lng, lat]`, a ordem do MapLibre/GeoJSON. */
export function toLngLat(point: GeoPoint): [number, number] {
  return [point.lng, point.lat]
}

/** `[[oeste, sul], [leste, norte]]` — formato aceito por `map.fitBounds`. */
export type LngLatBounds = [[number, number], [number, number]]

/**
 * Enquadramento do mapa da busca. Com um ponto só (ou vários no mesmo
 * lugar), não há caixa: quem chama centraliza no ponto com zoom fixo.
 */
export function boundsOf(points: GeoPoint[]): LngLatBounds | null {
  if (points.length === 0) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }
  if (minLat === maxLat && minLng === maxLng) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

/**
 * Links de rota nos apps do celular. Com coordenadas, vão direto ao ponto
 * marcado pelo dono; sem elas, buscam pelo endereço em texto (comportamento
 * anterior).
 */
export function directionsLinks(
  point: GeoPoint | null,
  address: string,
): { googleMaps: string; waze: string } | null {
  if (point) {
    const ll = `${point.lat},${point.lng}`
    return {
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll)}`,
      waze: `https://waze.com/ul?ll=${encodeURIComponent(ll)}&navigate=yes`,
    }
  }
  const query = address.trim()
  if (!query) return null
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    waze: `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`,
  }
}

const NUMBER = /^-?\d{1,3}(?:\.\d+)?$/

/**
 * Coordenadas coladas pelo dono (ex.: copiadas do Google Maps):
 * "-21.12345, -44.12345", "-21.12345 -44.12345" ou, com vírgula decimal,
 * "-21,12345; -44,12345". Devolve `null` se não entender ou se cair fora do
 * Brasil.
 */
export function parseCoordinatesText(text: string): GeoPoint | null {
  const value = text.trim()
  if (!value) return null
  let parts: string[]
  if (value.includes(';')) {
    parts = value.split(';').map((part) => part.trim().replace(',', '.'))
  } else {
    const match = /^(-?\d{1,3}(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d{1,3}(?:\.\d+)?)$/.exec(value)
    if (!match) return null
    parts = [match[1]!, match[2]!]
  }
  if (parts.length !== 2 || parts.some((part) => !NUMBER.test(part))) return null
  const point = { lat: Number(parts[0]), lng: Number(parts[1]) }
  return isInsideBrazil(point) ? roundPoint(point) : null
}
