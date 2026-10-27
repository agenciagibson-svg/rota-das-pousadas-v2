import type { GeocodeResult } from '@/lib/geo/nominatim'
import type { GeoPoint } from '@/types'

/** Texto para o dono depois de "Buscar pelo endereço". */
export function geocodeMessage(result: GeocodeResult): string {
  switch (result.status) {
    case 'found':
      return result.precision === 'endereco'
        ? 'Encontramos o endereço. Confira se o alfinete está na pousada, ajuste se precisar e salve.'
        : 'Encontramos só a cidade. Arraste o alfinete até a pousada (ou clique no mapa) e salve.'
    case 'not_found':
      return 'Não encontramos esse endereço no mapa. Marque o ponto clicando no mapa.'
    case 'unavailable':
      return 'A busca de endereço não respondeu agora. Marque o ponto clicando no mapa ou tente de novo em instantes.'
  }
}

export function samePoint(a: GeoPoint | null, b: GeoPoint | null): boolean {
  if (!a || !b) return a === b
  return a.lat === b.lat && a.lng === b.lng
}
