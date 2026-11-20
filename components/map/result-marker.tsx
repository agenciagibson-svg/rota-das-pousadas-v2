'use client'

import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import type { MapResult } from './result-card'
import type { MapState } from './use-map'
import { useMarkerElement } from './use-marker'

/**
 * Etiqueta de uma pousada no mapa (preço "a partir de", ou o nome quando não
 * há preço). Usada no mapa da busca e no mapa dos guias do blog.
 */
export function ResultMarker({
  state,
  result,
  selected,
  onSelect,
}: {
  state: MapState
  result: MapResult
  selected: boolean
  onSelect: () => void
}) {
  const element = useMarkerElement(state, result.point, { anchor: 'center' })
  if (!element) return null
  const price = result.price > 0 ? formatPrice(result.price) : null
  return createPortal(
    <Button
      type="button"
      size="pill-sm"
      variant={selected ? 'accent' : 'default'}
      aria-pressed={selected}
      aria-label={`${result.name}${price ? `, a partir de ${price} a diária` : ''}`}
      className="shadow-floating tabular-nums"
      onClick={onSelect}
    >
      {price ?? result.name}
    </Button>,
    element,
  )
}
