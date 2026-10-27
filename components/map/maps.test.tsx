// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * O MapLibre de verdade precisa de WebGL2 e de rede (tiles do OpenFreeMap),
 * que não existem aqui. Estes testes trocam `./maplibre` por um dublê e
 * conferem a ligação dos componentes: opções do mapa, alfinetes, clique,
 * arraste, enquadramento e falha. A renderização real do mapa NÃO é
 * exercitada.
 */
type Handler = (event: { lngLat: { lat: number; lng: number } }) => void

const fake = vi.hoisted(() => {
  class FakeMap {
    handlers: Record<string, Handler[]> = {}
    fitBounds = vi.fn()
    jumpTo = vi.fn()
    remove = vi.fn()
    isStyleLoaded = () => true
    on(type: string, handler: Handler) {
      ;(this.handlers[type] ??= []).push(handler)
      return this
    }
    off(type: string, handler: Handler) {
      this.handlers[type] = (this.handlers[type] ?? []).filter((h) => h !== handler)
      return this
    }
    fire(type: string, event: { lngLat: { lat: number; lng: number } }) {
      for (const h of this.handlers[type] ?? []) h(event)
    }
  }
  class FakeMarker {
    lngLat: [number, number] = [0, 0]
    handlers: Record<string, () => void> = {}
    removed = false
    constructor(public options: { element: HTMLElement; draggable: boolean; anchor: string }) {
      state.markers.push(this)
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat
      return this
    }
    addTo(map: FakeMap) {
      document.body.appendChild(this.options.element)
      void map
      return this
    }
    on(type: string, handler: () => void) {
      this.handlers[type] = handler
      return this
    }
    getLngLat() {
      return { lng: this.lngLat[0], lat: this.lngLat[1] }
    }
    getElement() {
      return this.options.element
    }
    remove() {
      this.removed = true
      this.options.element.remove()
    }
  }
  const state = {
    maps: [] as FakeMap[],
    markers: [] as FakeMarker[],
    fail: false,
    createMap: vi.fn((options: unknown) => {
      void options
      if (state.fail) throw new Error('WebGL2 indisponível')
      const map = new FakeMap()
      state.maps.push(map)
      return map
    }),
    FakeMarker,
  }
  return state
})

vi.mock('./maplibre', () => ({ createMap: fake.createMap, Marker: fake.FakeMarker }))

import { PousadaLocationMap } from './pousada-location-map'
import { LocationPickerMap } from './location-picker-map'
import { PousadasResultsMap, type MapResult } from './pousadas-results-map'

beforeEach(() => {
  fake.maps.length = 0
  fake.markers.length = 0
  fake.fail = false
  fake.createMap.mockClear()
})
afterEach(cleanup)

describe('PousadaLocationMap (página pública)', () => {
  it('cria o mapa claro, em zoom de rua, com gestos cooperativos e o alfinete no ponto', async () => {
    render(<PousadaLocationMap point={{ lat: -21.72, lng: -44.98 }} name="Pousada Teste" />)
    await waitFor(() => expect(fake.markers).toHaveLength(1))

    expect(fake.createMap).toHaveBeenCalledWith(
      expect.objectContaining({
        style: 'positron',
        center: [-44.98, -21.72],
        zoom: 16,
        cooperativeGestures: true,
      }),
    )
    const marker = fake.markers[0]!
    expect(marker.lngLat).toEqual([-44.98, -21.72])
    expect(marker.options.draggable).toBe(false)
    // O alfinete do Design System foi desenhado dentro do marcador.
    await waitFor(() => expect(marker.options.element.querySelector('svg')).not.toBeNull())
    expect(screen.getByRole('region', { name: /Localização de Pousada Teste/ })).toBeTruthy()
  })

  it('sem WebGL2, mostra um aviso em vez de um quadro vazio', async () => {
    fake.fail = true
    render(<PousadaLocationMap point={{ lat: -21.72, lng: -44.98 }} name="Pousada Teste" />)
    expect(await screen.findByText(/Não foi possível carregar o mapa/)).toBeTruthy()
  })

  it('remove o mapa ao sair da página', async () => {
    const { unmount } = render(
      <PousadaLocationMap point={{ lat: -21.72, lng: -44.98 }} name="Pousada Teste" />,
    )
    await waitFor(() => expect(fake.maps).toHaveLength(1))
    unmount()
    expect(fake.maps[0]!.remove).toHaveBeenCalled()
  })
})

describe('LocationPickerMap (painel)', () => {
  it('sem ponto, abre no Brasil inteiro e sem alfinete; clicar marca o ponto', async () => {
    const onPick = vi.fn()
    render(<LocationPickerMap point={null} onPick={onPick} focus={null} label="Mapa" />)
    await waitFor(() => expect(fake.maps).toHaveLength(1))
    expect(fake.createMap).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'liberty', zoom: 3.5, cooperativeGestures: true }),
    )
    expect(fake.markers).toHaveLength(0)

    act(() => fake.maps[0]!.fire('click', { lngLat: { lat: -21.123456789, lng: -44.987654321 } }))
    expect(onPick).toHaveBeenCalledWith({ lat: -21.123457, lng: -44.987654 })
  })

  it('alfinete arrastável; soltar informa o novo ponto; focus move a câmera', async () => {
    const onPick = vi.fn()
    const { rerender } = render(
      <LocationPickerMap
        point={{ lat: -21, lng: -44 }}
        onPick={onPick}
        focus={null}
        label="Mapa"
      />,
    )
    await waitFor(() => expect(fake.markers).toHaveLength(1))
    const marker = fake.markers[0]!
    expect(marker.options.draggable).toBe(true)

    marker.setLngLat([-44.5, -21.5])
    act(() => marker.handlers.dragend!())
    expect(onPick).toHaveBeenCalledWith({ lat: -21.5, lng: -44.5 })

    rerender(
      <LocationPickerMap
        point={{ lat: -22, lng: -45 }}
        onPick={onPick}
        focus={{ point: { lat: -22, lng: -45 }, zoom: 16, key: 1 }}
        label="Mapa"
      />,
    )
    await waitFor(() =>
      expect(fake.maps[0]!.jumpTo).toHaveBeenCalledWith({ center: [-45, -22], zoom: 16 }),
    )
    // O mesmo marcador foi movido, não recriado.
    expect(fake.markers).toHaveLength(1)
    expect(marker.lngLat).toEqual([-45, -22])
  })
})

describe('PousadasResultsMap (busca)', () => {
  const results: MapResult[] = [
    {
      slug: 'pousada-a',
      name: 'Pousada A',
      city: 'Cidade A',
      state: 'MG',
      image: '/placeholder.svg',
      price: 320,
      href: '/pousada/pousada-a?checkin=2099-01-01',
      point: { lat: -21.7, lng: -44.9 },
    },
    {
      slug: 'pousada-b',
      name: 'Pousada B',
      city: 'Cidade B',
      state: 'RJ',
      image: '/placeholder.svg',
      price: 0,
      href: '/pousada/pousada-b',
      point: { lat: -22.9, lng: -43.2 },
    },
  ]

  it('um alfinete por pousada, com o preço; enquadra todas sem animação', async () => {
    render(<PousadasResultsMap results={results} />)
    await waitFor(() => expect(fake.markers).toHaveLength(2))
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledWith(
      [
        [-44.9, -22.9],
        [-43.2, -21.7],
      ],
      expect.objectContaining({ animate: false, maxZoom: 14 }),
    )
    expect(
      await screen.findByRole('button', { name: /Pousada A, a partir de R\$ 320/ }),
    ).toBeTruthy()
    // Sem preço, a etiqueta mostra o nome (nada de "R$ 0").
    expect(screen.getByRole('button', { name: 'Pousada B' }).textContent).toBe('Pousada B')
  })

  it('clicar no alfinete abre o cartão com o link da pousada (com as datas)', async () => {
    render(<PousadasResultsMap results={results} />)
    fireEvent.click(await screen.findByRole('button', { name: /Pousada A/ }))
    const link = await screen.findByRole('link', { name: 'Ver pousada' })
    expect(link.getAttribute('href')).toBe('/pousada/pousada-a?checkin=2099-01-01')
    expect(screen.getByText(/a partir de/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('link', { name: 'Ver pousada' })).toBeNull()
  })
})
