import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_LOCALE_PT_BR, MAP_STYLES, type MapStyleName } from './map-config'

/**
 * Único ponto do app que importa o MapLibre. Este módulo NUNCA é importado
 * estaticamente: `use-map.ts` o carrega com `import()` no navegador, quando o
 * mapa está para aparecer na tela. Assim o MapLibre (~1 MB) e o CSS dele só
 * descem nas páginas que mostram mapa, e só no cliente (ele usa WebGL e
 * `window`).
 *
 * O MapLibre 6 roda o processamento dos tiles num Web Worker. Com bundler, o
 * endereço do worker precisa ser informado (guia de instalação do MapLibre,
 * seção Turbopack/Next.js): `new URL(..., import.meta.url)` faz o Next
 * publicar o arquivo em `/_next/static/` e devolve a URL do MESMO domínio. Por
 * isso a CSP precisa só de `worker-src 'self'` — sem `blob:`.
 */
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())

export { Marker }
export type { MapLibreMap }

export type CreateMapOptions = {
  container: HTMLElement
  style: MapStyleName
  center: [number, number]
  zoom: number
  /** Rolagem/arraste só com Ctrl (ou ⌘) ou dois dedos: a página não "prende" no mapa. */
  cooperativeGestures: boolean
  ariaLabel: string
}

export function createMap(options: CreateMapOptions): MapLibreMap {
  const map = new MapLibreMap({
    container: options.container,
    style: MAP_STYLES[options.style],
    center: options.center,
    zoom: options.zoom,
    cooperativeGestures: options.cooperativeGestures,
    locale: MAP_LOCALE_PT_BR,
    // Mapa plano: girar/inclinar só confunde quem quer achar a pousada.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    // Créditos obrigatórios (OpenFreeMap/OpenMapTiles/OpenStreetMap) — nunca desligar.
    attributionControl: { compact: true },
  })
  map.touchZoomRotate.disableRotation()
  map.keyboard.disableRotation()
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  map.getCanvas().setAttribute('aria-label', options.ariaLabel)
  return map
}
