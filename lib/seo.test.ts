import { describe, expect, it } from 'vitest'
import type { Pousada } from '@/types'
import { organizationJsonLd, pousadaJsonLd } from './seo'

const pousada = {
  slug: 'chale-teste',
  name: 'Chalé Teste',
  city: 'Uberlândia',
  state: 'MG',
  image: '/a.jpg',
  gallery: [],
  rating: 0,
  reviews: 0,
  pricePerNight: 500,
  tags: [],
  description: 'Chalé de teste.',
  instagram: '',
} as Pousada

describe('dados estruturados', () => {
  it('pousada sem avaliação não leva nota zerada', () => {
    expect(pousadaJsonLd(pousada)).not.toHaveProperty('aggregateRating')
    expect(pousadaJsonLd({ ...pousada, rating: 4.8, reviews: 12 })).toHaveProperty(
      'aggregateRating.reviewCount',
      12,
    )
  })

  it('raiz declara o site com nomes alternativos e a busca de pousadas', () => {
    const graph = organizationJsonLd()['@graph'] as Array<Record<string, unknown>>
    const site = graph.find((n) => n['@type'] === 'WebSite')!
    expect(site.name).toBe('Rota das Pousadas')
    expect(site.alternateName).toContain('Rota Pousadas')
    expect(JSON.stringify(site.potentialAction)).toContain('/pousadas?busca={search_term_string}')
    const org = graph.find((n) => n['@type'] === 'Organization')!
    expect(String(org.logo)).toMatch(/\.png$/)
  })
})
