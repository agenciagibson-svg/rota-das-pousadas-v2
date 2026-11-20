import { describe, expect, it, vi } from 'vitest'
import { addHillshade, setTerrain3D, TERRAIN_TILES } from './terrain'
import type { MapLibreMap } from './maplibre'

function fakeMap() {
  const sources = new Map<string, unknown>()
  const layers: { id: string; before?: string }[] = []
  const toggle = () => ({ enable: vi.fn(), disable: vi.fn() })
  const map = {
    isStyleLoaded: () => true,
    once: vi.fn((_e: string, fn: () => void) => fn()),
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string, s: unknown) => sources.set(id, s)),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer: vi.fn((l: { id: string }, before?: string) => layers.push({ id: l.id, before })),
    getStyle: () => ({
      layers: [
        { id: 'agua', type: 'fill' },
        { id: 'nomes', type: 'symbol' },
      ],
    }),
    setTerrain: vi.fn(),
    easeTo: vi.fn(),
    dragRotate: toggle(),
    touchPitch: toggle(),
  }
  return { map: map as unknown as MapLibreMap, raw: map, layers, sources }
}

describe('relevo dos mapas', () => {
  it('sombreado entra uma vez, abaixo dos nomes, com os tiles de altitude', () => {
    const { map, raw, layers, sources } = fakeMap()
    addHillshade(map)
    addHillshade(map)
    expect(raw.addSource).toHaveBeenCalledTimes(1)
    expect((sources.get('relevo') as { tiles: string[] }).tiles).toEqual([TERRAIN_TILES])
    expect(layers).toEqual([{ id: 'relevo-sombra', before: 'nomes' }])
  })

  it('3D liga o relevo e inclina; 2D volta plano e com o norte para cima', () => {
    const { map, raw } = fakeMap()
    addHillshade(map)
    setTerrain3D(map, true, 500)
    expect(raw.setTerrain).toHaveBeenCalledWith(expect.objectContaining({ source: 'relevo' }))
    expect(raw.easeTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ pitch: 60, duration: 500 }),
    )
    setTerrain3D(map, false, 500)
    expect(raw.easeTo).toHaveBeenLastCalledWith({ pitch: 0, bearing: 0, duration: 500 })
    expect(raw.setTerrain).toHaveBeenLastCalledWith(null)
    expect(raw.dragRotate.disable).toHaveBeenCalled()
  })
})

describe('satélite', () => {
  it('entra por baixo dos nomes só quando ligado e some ao desligar', async () => {
    const { setSatellite, satelliteTiles } = await import('./satellite')
    const layout: Record<string, string> = {}
    const layers: { id: string; before?: string }[] = []
    const sources = new Map<string, { tiles: string[] }>()
    const map = {
      isStyleLoaded: () => true,
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, s: { tiles: string[] }) => sources.set(id, s),
      getLayer: (id: string) => layers.find((l) => l.id === id),
      addLayer: (l: { id: string }, before?: string) => layers.push({ id: l.id, before }),
      getStyle: () => ({
        layers: [
          { id: 'estradas', type: 'line' },
          { id: 'nomes', type: 'symbol' },
        ],
      }),
      setLayoutProperty: (id: string, _p: string, v: string) => (layout[id] = v),
    } as unknown as MapLibreMap
    setSatellite(map, false, 'chave')
    expect(sources.size).toBe(0)
    setSatellite(map, true, 'chave')
    expect(sources.get('satelite')?.tiles).toEqual([satelliteTiles('chave')])
    expect(layers).toEqual([{ id: 'satelite-foto', before: 'nomes' }])
    expect(layout['satelite-foto']).toBe('visible')
    setSatellite(map, false, 'chave')
    expect(layout['satelite-foto']).toBe('none')
  })
})
