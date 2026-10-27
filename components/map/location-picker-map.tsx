'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BRAZIL_CENTER, roundPoint, toLngLat, type GeoPoint } from '@/lib/geo/coordinates'
import { COUNTRY_ZOOM, STREET_ZOOM } from './map-config'
import { MapPinMark } from './map-pin'
import { MapSurface } from './map-surface'
import { useMap } from './use-map'
import { useMarkerElement } from './use-marker'

/** Pedido para a câmera ir até um ponto (ex.: resultado da busca pelo endereço). */
export type MapFocus = { point: GeoPoint; zoom: number; key: number }

/**
 * Mapa do painel para marcar o ponto da pousada: clicar no mapa ou arrastar o
 * alfinete. Sem ponto ainda, abre no Brasil inteiro. A câmera só se move
 * quando `focus` muda — clicar não fica recentralizando o mapa.
 */
export function LocationPickerMap({
  point,
  onPick,
  focus,
  label,
}: {
  point: GeoPoint | null
  onPick: (point: GeoPoint) => void
  focus: MapFocus | null
  label: string
}) {
  const { containerRef, state } = useMap({
    style: 'liberty',
    center: toLngLat(point ?? BRAZIL_CENTER),
    zoom: point ? STREET_ZOOM : COUNTRY_ZOOM,
    cooperativeGestures: true,
    ariaLabel: label,
  })
  const pin = useMarkerElement(state, point, { draggable: true, onDragEnd: onPick })

  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  })

  useEffect(() => {
    if (state.status !== 'ready') return
    const map = state.map
    const onClick = (event: { lngLat: { lat: number; lng: number } }) => {
      pick.current(roundPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng }))
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [state])

  useEffect(() => {
    if (state.status !== 'ready' || !focus) return
    // Salto sem animação: os únicos tempos de movimento do app são os tokens.
    state.map.jumpTo({ center: toLngLat(focus.point), zoom: focus.zoom })
  }, [state, focus])

  return (
    <MapSurface
      containerRef={containerRef}
      state={state}
      label={label}
      className="aspect-[4/3] w-full sm:aspect-[16/9]"
    >
      {pin && createPortal(<MapPinMark className="cursor-grab active:cursor-grabbing" />, pin)}
    </MapSurface>
  )
}
