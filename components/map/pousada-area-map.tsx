'use client'

import { toLngLat, type GeoPoint } from '@/lib/geo/coordinates'
import { AREA_ZOOM } from './map-config'
import { MapSurface } from './map-surface'
import { useMap } from './use-map'

/**
 * Mapa da REGIÃO na página da pousada que ainda não marcou o ponto exato:
 * centro da cidade, zoom de cidade e nenhum alfinete — para não parecer que
 * a pousada fica no centro. O selo "Região aproximada" deixa isso claro.
 */
export function PousadaAreaMap({
  center,
  city,
  name,
}: {
  center: GeoPoint
  city: string
  name: string
}) {
  const { containerRef, state } = useMap({
    style: 'positron',
    center: toLngLat(center),
    zoom: AREA_ZOOM,
    cooperativeGestures: true,
    ariaLabel: `Mapa da região de ${city}, onde fica ${name}`,
    lazy: true,
  })

  return (
    <MapSurface
      containerRef={containerRef}
      state={state}
      label={`Região de ${city} no mapa`}
      className="aspect-[4/3] w-full sm:aspect-[16/9]"
    >
      <span className="bg-card/95 text-foreground shadow-card pointer-events-none absolute top-3 left-3 rounded-full px-3 py-1.5 text-xs font-semibold">
        Região aproximada
      </span>
    </MapSurface>
  )
}
