/**
 * Canonical domain model for Rota das Pousadas.
 *
 * This is the single source of truth for the shapes that flow through the app.
 * When a real database is introduced, these types become the contract that the
 * ORM schema and the service layer must satisfy — nothing in the UI needs to
 * change.
 */

export type Season = 'verao' | 'outono' | 'inverno' | 'primavera'

export type Destination = {
  slug: string
  name: string
  state: string
  image: string
  pousadas: number
  rating: number
  priceFrom: number
  season: Season[]
}

export type Experience = {
  slug: string
  name: string
  /** Lucide icon name, resolved by the presentation layer. */
  icon: string
  description: string
}

/** Ponto no mapa em graus decimais (WGS 84). Regras em `lib/geo/coordinates.ts`. */
export type GeoPoint = { lat: number; lng: number }

export type Pousada = {
  slug: string
  name: string
  city: string
  state: string
  image: string
  gallery: string[]
  rating: number
  reviews: number
  pricePerNight: number
  tags: string[]
  description: string
  instagram: string
  /** Hóspedes por acomodação (modo demonstração; no banco vem das acomodações). */
  maxGuests?: number
  /**
   * Campos reais abaixo (existem no banco desde a 0010, editáveis pelo
   * proprietário em `/dashboard/configuracoes`) — opcionais porque o modo
   * demonstração (`lib/data.ts`, sem Supabase configurado) não os preenche.
   */
  id?: string
  address?: string
  cep?: string | null
  checkinTime?: string
  checkoutTime?: string
  cancellationPolicy?: string
  houseRules?: string
  whatsapp?: string
  contactPhone?: string
  /**
   * Ponto marcado pelo dono no painel (0095). `null`/ausente = sem mapa —
   * a página e a busca não inventam um ponto a partir da cidade.
   */
  coordinates?: GeoPoint | null
}

export type Room = {
  name: string
  price: number
  guests: number
  size: string
  desc: string
}

export type Review = {
  name: string
  location: string
  rating: number
  text: string
}
