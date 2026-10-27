import { describe, expect, it } from 'vitest'
import { MAP_LOCALE_PT_BR, MAP_STYLES, RESULTS_MAX_ZOOM, resultsCamera } from './map-config'

describe('resultsCamera (mapa da busca)', () => {
  it('sem resultados com ponto, não há câmera (a página não mostra mapa)', () => {
    expect(resultsCamera([])).toBeNull()
  })

  it('um resultado: centraliza nele em zoom de bairro', () => {
    expect(resultsCamera([{ lat: -21.7, lng: -44.9 }])).toEqual({
      kind: 'center',
      center: [-44.9, -21.7],
      zoom: RESULTS_MAX_ZOOM,
    })
  })

  it('vários: enquadra todos, sem aproximar demais', () => {
    expect(
      resultsCamera([
        { lat: -21.7, lng: -44.9 },
        { lat: -22.9, lng: -43.2 },
        { lat: -23.5, lng: -46.6 },
      ]),
    ).toEqual({
      kind: 'bounds',
      bounds: [
        [-46.6, -23.5],
        [-43.2, -21.7],
      ],
      padding: 56,
      maxZoom: RESULTS_MAX_ZOOM,
    })
  })
})

describe('configuração do mapa', () => {
  it('estilos só do OpenFreeMap (o mesmo domínio liberado na CSP)', () => {
    for (const url of Object.values(MAP_STYLES)) {
      expect(new URL(url).origin).toBe('https://tiles.openfreemap.org')
    }
  })

  it('aviso dos gestos cooperativos em português', () => {
    expect(MAP_LOCALE_PT_BR['CooperativeGesturesHandler.WindowsHelpText']).toMatch(/Ctrl/)
    expect(MAP_LOCALE_PT_BR['CooperativeGesturesHandler.MobileHelpText']).toMatch(/dois dedos/)
  })
})
