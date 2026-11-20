'use client'

import { useEffect, useState } from 'react'
import { BRAZIL_CENTER, toLngLat } from '@/lib/geo/coordinates'
import { COUNTRY_ZOOM, resultsCamera } from './map-config'
import { MapSurface } from './map-surface'
import { ResultCard, type MapResult } from './result-card'
import { ResultMarker } from './result-marker'
import { useMap } from './use-map'

export type { MapResult }

/**
 * Mapa da busca `/pousadas`: uma etiqueta por pousada do resultado (com o
 * preço "a partir de" que a busca já calculou), enquadrando todas. Clicar
 * abre um cartão com o link para a pousada.
 */
export function PousadasResultsMap({ results }: { results: MapResult[] }) {
  const { containerRef, state } = useMap({
    style: 'positron',
    center: toLngLat(results[0]?.point ?? BRAZIL_CENTER),
    zoom: COUNTRY_ZOOM,
    cooperativeGestures: true,
    ariaLabel: 'Mapa com as pousadas encontradas',
  })
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const selected = results.find((r) => r.slug === selectedSlug) ?? null

  // Enquadra os resultados (sem animação) quando o mapa fica pronto ou a lista muda.
  useEffect(() => {
    if (state.status !== 'ready') return
    const camera = resultsCamera(results.map((r) => r.point))
    if (!camera) return
    if (camera.kind === 'bounds') {
      state.map.fitBounds(camera.bounds, {
        padding: camera.padding,
        maxZoom: camera.maxZoom,
        animate: false,
      })
    } else {
      state.map.jumpTo({ center: camera.center, zoom: camera.zoom })
    }
  }, [state, results])

  return (
    <MapSurface
      containerRef={containerRef}
      state={state}
      label="Pousadas encontradas no mapa"
      className="aspect-[4/5] w-full sm:aspect-[16/10]"
    >
      {results.map((result) => (
        <ResultMarker
          key={result.slug}
          state={state}
          result={result}
          selected={result.slug === selectedSlug}
          onSelect={() => setSelectedSlug(result.slug)}
        />
      ))}
      {selected && <ResultCard result={selected} onClose={() => setSelectedSlug(null)} />}
    </MapSurface>
  )
}
