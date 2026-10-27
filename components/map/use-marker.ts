'use client'

import { useEffect, useRef, useState } from 'react'
import type { Marker } from 'maplibre-gl'
import { toLngLat, type GeoPoint } from '@/lib/geo/coordinates'
import type { MapState } from './use-map'

type MarkerOptions = {
  draggable?: boolean
  /** `bottom`: a ponta do alfinete fica no ponto. `center`: etiqueta de preço. */
  anchor?: 'bottom' | 'center'
  onDragEnd?: (point: GeoPoint) => void
}

/**
 * Marcador do MapLibre com conteúdo React: devolve o elemento do marcador
 * para o chamador desenhar dentro dele com `createPortal` — assim o alfinete
 * usa os componentes e tokens do Design System (Button, cores da marca).
 */
export function useMarkerElement(
  state: MapState,
  point: GeoPoint | null,
  options: MarkerOptions = {},
): HTMLElement | null {
  const [element] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  )
  // Só o tipo: a biblioteca em si chega por `state.lib` (import dinâmico).
  const markerRef = useRef<Marker | null>(null)
  const latest = useRef({ point, onDragEnd: options.onDragEnd })
  useEffect(() => {
    latest.current = { point, onDragEnd: options.onDragEnd }
  })
  const { draggable = false, anchor = 'bottom' } = options
  const hasPoint = point !== null

  // Cria/remove o marcador quando o mapa fica pronto ou o ponto aparece/some.
  useEffect(() => {
    const start = latest.current.point
    if (state.status !== 'ready' || !element || !start) return
    const marker = new state.lib.Marker({ element, anchor, draggable })
      .setLngLat(toLngLat(start))
      .addTo(state.map)
    markerRef.current = marker
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      latest.current.onDragEnd?.({ lat, lng })
    })
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [state, element, hasPoint, anchor, draggable])

  // Move o marcador sem recriar (clique no mapa, busca pelo endereço).
  useEffect(() => {
    if (point) markerRef.current?.setLngLat(toLngLat(point))
  }, [point])

  return state.status === 'ready' && hasPoint ? element : null
}
