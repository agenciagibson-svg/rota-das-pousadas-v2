'use client'

import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { MapState } from '@/components/map/use-map'
import { useMarkerElement } from '@/components/map/use-marker'
import type { BlogPlace } from '../types'
import { PlaceIcon } from './place-icon'

/** Ponto do guia no mapa: ícone do tipo + nome (o nome só aparece selecionado no celular). */
export function PlaceMarker({
  state,
  place,
  selected,
  onSelect,
}: {
  state: MapState
  place: BlogPlace
  selected: boolean
  onSelect: () => void
}) {
  const element = useMarkerElement(state, place.point, { anchor: 'center' })
  if (!element) return null
  return createPortal(
    <Button
      type="button"
      size="pill-sm"
      variant={selected ? 'secondary' : 'outline'}
      aria-pressed={selected}
      aria-label={place.name}
      className="shadow-floating max-w-56 px-3"
      onClick={onSelect}
    >
      <PlaceIcon kind={place.kind} className="size-4 shrink-0" />
      <span className={selected ? 'truncate' : 'hidden truncate sm:inline'}>{place.name}</span>
    </Button>,
    element,
  )
}
