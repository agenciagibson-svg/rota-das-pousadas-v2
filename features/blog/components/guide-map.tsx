'use client'

import { useEffect, useState } from 'react'
import { BedDouble } from 'lucide-react'
import { MapSurface } from '@/components/map/map-surface'
import { AREA_ZOOM, resultsCamera } from '@/components/map/map-config'
import { ResultCard, type MapResult } from '@/components/map/result-card'
import { ResultMarker } from '@/components/map/result-marker'
import { useMap } from '@/components/map/use-map'
import { toLngLat } from '@/lib/geo/coordinates'
import type { BlogPlace } from '../types'
import { PlaceCard } from './place-card'
import { PlaceMarker } from './place-marker'

type Selection = { kind: 'place'; index: number } | { kind: 'stay'; slug: string } | null

/**
 * Mapa do guia: os pontos do texto (cachoeiras, mirantes, cidades) e as
 * pousadas da Rota na região, no mesmo mapa. Clicar num ponto abre o cartão
 * com "Como chegar"; numa pousada, o cartão com o link para reservar.
 */
export function GuideMap({ places, stays }: { places: BlogPlace[]; stays: MapResult[] }) {
  const { containerRef, state } = useMap({
    style: 'positron',
    center: toLngLat(places[0]?.point ?? stays[0]!.point),
    zoom: AREA_ZOOM,
    cooperativeGestures: true,
    ariaLabel: 'Mapa com os lugares do guia e as pousadas da região',
    lazy: true,
  })
  const [selection, setSelection] = useState<Selection>(null)

  useEffect(() => {
    if (state.status !== 'ready') return
    const camera = resultsCamera([...places.map((p) => p.point), ...stays.map((s) => s.point)])
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
  }, [state, places, stays])

  const place = selection?.kind === 'place' ? places[selection.index] : undefined
  const stay = selection?.kind === 'stay' ? stays.find((s) => s.slug === selection.slug) : undefined

  return (
    <div>
      <MapSurface
        containerRef={containerRef}
        state={state}
        label="Mapa do guia"
        className="aspect-[4/5] w-full sm:aspect-[16/10]"
      >
        {places.map((p, index) => (
          <PlaceMarker
            key={p.name}
            state={state}
            place={p}
            selected={selection?.kind === 'place' && selection.index === index}
            onSelect={() => setSelection({ kind: 'place', index })}
          />
        ))}
        {stays.map((s) => (
          <ResultMarker
            key={s.slug}
            state={state}
            result={s}
            selected={selection?.kind === 'stay' && selection.slug === s.slug}
            onSelect={() => setSelection({ kind: 'stay', slug: s.slug })}
          />
        ))}
        {place && <PlaceCard place={place} onClose={() => setSelection(null)} />}
        {stay && <ResultCard result={stay} onClose={() => setSelection(null)} />}
      </MapSurface>
      <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>Toque num ponto para ver como chegar.</span>
        {stays.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <BedDouble className="size-4" aria-hidden />
            Etiquetas escuras são pousadas da Rota.
          </span>
        )}
      </p>
    </div>
  )
}
