import type { MapLibreMap } from './maplibre'

/**
 * Foto de satélite nos mapas dos guias (Esri World Imagery, ArcGIS Location
 * Platform — licença comercial, 2 milhões de tiles grátis por mês). Só baixa
 * quando a pessoa toca em "Satélite": o mapa abre no desenho gratuito.
 *
 * A camada entra por baixo dos nomes (camadas `symbol`): estradas e áreas do
 * mapa desenhado ficam escondidas pela foto, e os nomes continuam legíveis.
 */
export function satelliteTiles(apiKey: string): string {
  return `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(apiKey)}`
}

const SOURCE = 'satelite'
const LAYER = 'satelite-foto'

export function setSatellite(map: MapLibreMap, on: boolean, apiKey: string): void {
  const run = () => {
    if (!on) {
      if (map.getLayer(LAYER)) map.setLayoutProperty(LAYER, 'visibility', 'none')
      return
    }
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, {
        type: 'raster',
        tiles: [satelliteTiles(apiKey)],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Satélite: Esri, Maxar, Earthstar Geographics e comunidade GIS',
      })
    }
    if (!map.getLayer(LAYER)) {
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
      map.addLayer({ id: LAYER, type: 'raster', source: SOURCE }, firstSymbol)
    }
    map.setLayoutProperty(LAYER, 'visibility', 'visible')
  }
  if (map.isStyleLoaded()) run()
  else map.once('load', run)
}
