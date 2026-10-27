import { boundsOf, toLngLat, type GeoPoint, type LngLatBounds } from '@/lib/geo/coordinates'

/**
 * Mapas vetoriais do OpenFreeMap (gratuitos, sem chave, dados do
 * OpenStreetMap atualizados toda semana). A atribuição obrigatória
 * ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap") vem dentro do
 * TileJSON do próprio OpenFreeMap e o controle de atribuição do MapLibre a
 * mostra sozinho — por isso ele nunca é desligado nos nossos mapas.
 *
 * Todos os arquivos (estilo, tiles, fontes, ícones) vêm de
 * `tiles.openfreemap.org`, liberado em `connect-src` na CSP (`proxy.ts`).
 *
 *  - `positron`: base clara e discreta — o alfinete da marca se destaca
 *    (página pública e busca).
 *  - `liberty`: mais detalhes (pontos de referência, prédios) — ajuda o dono
 *    a achar a própria casa ao marcar o ponto no painel.
 */
export const MAP_STYLES = {
  positron: 'https://tiles.openfreemap.org/styles/positron',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
} as const
export type MapStyleName = keyof typeof MAP_STYLES

/** Zoom de rua (página da pousada e ponto encontrado pelo endereço). */
export const STREET_ZOOM = 16
/** Zoom de cidade (a busca achou só a cidade). */
export const CITY_ZOOM = 13
/** Brasil inteiro (painel, antes de marcar). */
export const COUNTRY_ZOOM = 3.5
/** Mapa da busca: não aproximar além disso ao enquadrar os resultados. */
export const RESULTS_MAX_ZOOM = 14

/** Textos dos controles do MapLibre em português. */
export const MAP_LOCALE_PT_BR: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Mostrar ou esconder créditos do mapa',
  'AttributionControl.MapFeedback': 'Sugerir correção no mapa',
  'Map.Title': 'Mapa',
  'Marker.Title': 'Alfinete no mapa',
  'NavigationControl.ResetBearing': 'Voltar o norte para cima',
  'NavigationControl.ZoomIn': 'Aproximar',
  'NavigationControl.ZoomOut': 'Afastar',
  'Popup.Close': 'Fechar',
  'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + rolagem para aproximar o mapa',
  'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + rolagem para aproximar o mapa',
  'CooperativeGesturesHandler.MobileHelpText': 'Use dois dedos para mover o mapa',
}

export type MapCamera =
  | { kind: 'bounds'; bounds: LngLatBounds; padding: number; maxZoom: number }
  | { kind: 'center'; center: [number, number]; zoom: number }

/**
 * Câmera inicial do mapa da busca: enquadra todos os alfinetes; com um só
 * (ou todos no mesmo lugar), centraliza nele em zoom de bairro.
 */
export function resultsCamera(points: GeoPoint[]): MapCamera | null {
  if (points.length === 0) return null
  const bounds = boundsOf(points)
  if (!bounds) return { kind: 'center', center: toLngLat(points[0]!), zoom: RESULTS_MAX_ZOOM }
  return { kind: 'bounds', bounds, padding: 56, maxZoom: RESULTS_MAX_ZOOM }
}
