'use client'

import { createPortal } from 'react-dom'
import { toLngLat, type GeoPoint } from '@/lib/geo/coordinates'
import { STREET_ZOOM } from './map-config'
import { MapPinMark } from './map-pin'
import { MapSurface } from './map-surface'
import { useMap } from './use-map'
import { useMarkerElement } from './use-marker'

/**
 * Mapa pequeno da página pública da pousada: alfinete no ponto marcado pelo
 * dono, zoom de rua. Gestos cooperativos — rolar a página por cima do mapa
 * rola a PÁGINA; aproximar pede Ctrl/⌘ + rolagem ou dois dedos no celular.
 * O MapLibre só é baixado quando a seção chega perto da tela.
 */
export function PousadaLocationMap({ point, name }: { point: GeoPoint; name: string }) {
  const { containerRef, state } = useMap({
    style: 'positron',
    center: toLngLat(point),
    zoom: STREET_ZOOM,
    cooperativeGestures: true,
    ariaLabel: `Mapa com a localização de ${name}`,
    lazy: true,
  })
  const pin = useMarkerElement(state, point)

  return (
    <MapSurface
      containerRef={containerRef}
      state={state}
      label={`Localização de ${name} no mapa`}
      className="aspect-[4/3] w-full sm:aspect-[16/9]"
    >
      {pin && createPortal(<MapPinMark />, pin)}
    </MapSurface>
  )
}
