'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LocateFixed, Save, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocationPickerMap, type MapFocus } from '@/components/map/location-picker-map'
import { CITY_ZOOM, STREET_ZOOM } from '@/components/map/map-config'
import { parseCoordinatesText, type GeoPoint } from '@/lib/geo/coordinates'
import { geocodePousadaAddressAction, updatePousadaLocationAction } from '../actions'
import { geocodeMessage, samePoint } from './location-messages'

/**
 * "Localização no mapa" das Configurações (h8). O dono marca o ponto da
 * pousada — clicando no mapa, arrastando o alfinete, buscando pelo endereço
 * salvo ou colando coordenadas — e salva. Sem ponto salvo, a página pública
 * não mostra mapa.
 */
export function PousadaLocationForm({
  initial,
  hasAddress,
}: {
  initial: GeoPoint | null
  /** Sem endereço nem cidade salvos não há o que buscar. */
  hasAddress: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<GeoPoint | null>(initial)
  const [point, setPoint] = useState<GeoPoint | null>(initial)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [pasted, setPasted] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [saving, startSave] = useTransition()

  const dirty = !samePoint(point, saved)

  function moveTo(next: GeoPoint, zoom: number) {
    setPoint(next)
    setFocus((current) => ({ point: next, zoom, key: (current?.key ?? 0) + 1 }))
  }

  function searchAddress() {
    setMessage(null)
    setError(null)
    startSearch(async () => {
      const result = await geocodePousadaAddressAction({})
      if (!result.ok) {
        setError(result.error)
        return
      }
      const found = result.data
      if (found.status === 'found') {
        moveTo(found.point, found.precision === 'endereco' ? STREET_ZOOM : CITY_ZOOM)
      }
      const text = geocodeMessage(found)
      if (found.status === 'found') setMessage(text)
      else setError(text)
    })
  }

  function applyPasted() {
    setMessage(null)
    const parsed = parseCoordinatesText(pasted)
    if (!parsed) {
      setError('Não entendemos essas coordenadas. Use o formato -21.12345, -44.12345.')
      return
    }
    setError(null)
    moveTo(parsed, STREET_ZOOM)
    setMessage('Ponto marcado. Confira no mapa e salve.')
  }

  function save(next: GeoPoint | null) {
    setMessage(null)
    setError(null)
    startSave(async () => {
      const result = await updatePousadaLocationAction({ location: next })
      if (!result.ok) {
        setError(
          result.fieldErrors ? 'Ponto inválido. Marque um lugar dentro do Brasil.' : result.error,
        )
        return
      }
      setSaved(result.data.location)
      setPoint(result.data.location)
      setMessage(
        result.data.location
          ? 'Localização salva. O mapa já aparece na página da pousada.'
          : 'Ponto removido. A página da pousada fica sem mapa.',
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <LocationPickerMap
        point={point}
        onPick={(next) => {
          setPoint(next)
          setMessage(null)
        }}
        focus={focus}
        label="Mapa para marcar o ponto da pousada"
      />
      <p className="text-muted-foreground text-xs">
        Clique no mapa ou arraste o alfinete até a entrada da pousada. Para aproximar, use Ctrl +
        rolagem (no celular, dois dedos). A busca usa o endereço salvo acima — se mudou o endereço,
        salve as configurações antes. Busca de endereços: © OpenStreetMap.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={searchAddress}
          disabled={searching || !hasAddress}
        >
          <Search className="size-4" />
          {searching ? 'Buscando…' : 'Buscar pelo endereço'}
        </Button>
        <Input
          label="Ou cole as coordenadas"
          name="coordinates"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              applyPasted()
            }
          }}
          placeholder="-21.12345, -44.12345"
          inputMode="decimal"
          autoComplete="off"
          wrapperClassName="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" size="lg" onClick={applyPasted} disabled={!pasted}>
          <LocateFixed className="size-4" />
          Usar
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="text-sm">
          {error && <p className="text-destructive font-medium">{error}</p>}
          {message && <p className="text-primary font-medium">{message}</p>}
          {!error && !message && (
            <p className="text-muted-foreground">
              {point
                ? `Ponto: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}${dirty ? ' (ainda não salvo)' : ''}`
                : 'Nenhum ponto marcado. Sem ponto, a página da pousada não mostra mapa.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {saved && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={() => save(null)}
              disabled={saving}
            >
              <Trash2 className="size-4" />
              Remover ponto
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            onClick={() => save(point)}
            disabled={saving || !point || !dirty}
          >
            <Save className="size-4" />
            {saving ? 'Salvando…' : 'Salvar localização'}
          </Button>
        </div>
      </div>
    </div>
  )
}
