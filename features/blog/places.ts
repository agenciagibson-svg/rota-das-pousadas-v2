import type { BlogPlace } from './types'

/**
 * Pontos dos mapas dos guias. Coordenadas do OpenStreetMap (Nominatim,
 * conferidas em 20/11/2026). Um ponto pode servir a mais de um guia.
 */
export const PLACES = {
  saoRoque: {
    name: 'São Roque de Minas',
    kind: 'cidade',
    point: { lat: -20.24528, lng: -46.36583 },
    note: 'Base mais perto da portaria principal do parque.',
  },
  vargemBonita: {
    name: 'Vargem Bonita',
    kind: 'cidade',
    point: { lat: -20.32821, lng: -46.36684 },
    note: 'Saída para a parte baixa da Casca d’Anta.',
  },
  delfinopolis: {
    name: 'Delfinópolis',
    kind: 'cidade',
    point: { lat: -20.34475, lng: -46.85464 },
    note: 'O lado das cachoeiras da Canastra.',
  },
  nascenteSaoFrancisco: {
    name: 'Nascente do Rio São Francisco',
    kind: 'parque',
    point: { lat: -20.24288, lng: -46.44653 },
    note: 'Dentro do parque nacional, no alto do chapadão.',
  },
  cascaDAnta: {
    name: 'Cachoeira Casca d’Anta',
    kind: 'cachoeira',
    point: { lat: -20.30191, lng: -46.52234 },
    note: 'Primeira grande queda do São Francisco: 186 metros.',
  },
  cachoeiraDaPaz: {
    name: 'Cachoeira da Paz (Complexo do Claro)',
    kind: 'cachoeira',
    point: { lat: -20.34181, lng: -46.80479 },
    note: 'Uma das quedas do Complexo do Claro, perto da cidade.',
  },
  matrizPirenopolis: {
    name: 'Igreja Matriz de N. S. do Rosário',
    kind: 'igreja',
    point: { lat: -15.85267, lng: -48.95893 },
    note: 'Coração do centro histórico, ao lado da Rua do Rosário.',
  },
  bonsucesso: {
    name: 'Cachoeiras Bonsucesso',
    kind: 'cachoeira',
    point: { lat: -15.82329, lng: -48.93872 },
    note: 'As mais perto do centro.',
    approximate: true,
  },
  abade: {
    name: 'Cachoeira do Abade',
    kind: 'cachoeira',
    point: { lat: -15.83921, lng: -48.885 },
    note: 'Queda de cerca de 20 metros com poço para banho.',
  },
  vagafogo: {
    name: 'Santuário Vagafogo',
    kind: 'parque',
    point: { lat: -15.825, lng: -48.99534 },
    note: 'Trilha no cerrado, poços e o brunch famoso.',
  },
  picoPireneus: {
    name: 'Pico dos Pireneus',
    kind: 'mirante',
    point: { lat: -15.79213, lng: -48.83518 },
    note: 'Capela no alto e vista de 360 graus.',
  },
} satisfies Record<string, BlogPlace>
