import type { MapLibreMap } from './maplibre'

/**
 * Relevo nos mapas dos guias do blog: sombreado das serras no 2D e o modo
 * "Ver em 3D" (mapa inclinado com as montanhas em altura).
 *
 * Altitude: Terrain Tiles da AWS (dados abertos, sem chave; formato
 * "terrarium"). O domínio está liberado na CSP (`proxy.ts`). Créditos dos
 * dados no controle de atribuição do mapa.
 */
export const TERRAIN_TILES =
  'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'

const SOURCE = 'relevo'
const HILLSHADE_LAYER = 'relevo-sombra'
/** Quanto as serras "sobem" no 3D (1 = altura real; um pouco mais lê melhor na tela). */
export const TERRAIN_EXAGGERATION = 1.4
export const PITCH_3D = 60

function whenStyleReady(map: MapLibreMap, run: () => void) {
  if (map.isStyleLoaded()) run()
  else map.once('load', run)
}

/** Sombreado do relevo por baixo das estradas e nomes. Idempotente. */
export function addHillshade(map: MapLibreMap): void {
  whenStyleReady(map, () => {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution:
          '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Relevo: Mapzen e outros</a>',
      })
    }
    if (map.getLayer(HILLSHADE_LAYER)) return
    // Abaixo da primeira camada de texto: nomes e estradas continuam legíveis.
    const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
    map.addLayer(
      {
        id: HILLSHADE_LAYER,
        type: 'hillshade',
        source: SOURCE,
        paint: { 'hillshade-exaggeration': 0.35 },
      },
      firstSymbol,
    )
  })
}

/**
 * Liga/desliga o 3D. No 3D a pessoa pode girar e inclinar à vontade; ao
 * voltar, o mapa fica plano e com o norte para cima de novo.
 */
export function setTerrain3D(map: MapLibreMap, on: boolean, durationMs: number): void {
  whenStyleReady(map, () => {
    if (on) {
      map.setTerrain({ source: SOURCE, exaggeration: TERRAIN_EXAGGERATION })
      map.dragRotate.enable()
      map.touchPitch.enable()
      map.easeTo({ pitch: PITCH_3D, bearing: -20, duration: durationMs })
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: durationMs })
      map.once('moveend', () => map.setTerrain(null))
      map.dragRotate.disable()
      map.touchPitch.disable()
    }
  })
}
