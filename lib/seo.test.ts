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

  it('pousada completa leva mapa, telefone, horários, preço e fotos com endereço certo', () => {
    const ld = pousadaJsonLd({
      ...pousada,
      image: 'https://x.supabase.co/storage/v1/object/public/pousadas/a.jpg',
      gallery: ['/b.jpg'],
      coordinates: { lat: -21.11, lng: -44.17 },
      contactPhone: '(32) 99999-0000',
      checkinTime: '14:00',
      checkoutTime: '12h',
      address: 'Rua Direita, 10',
      cep: '36325-000',
      instagram: 'https://instagram.com/chaleteste/',
    }) as Record<string, unknown>
    expect(ld.image).toEqual([
      'https://x.supabase.co/storage/v1/object/public/pousadas/a.jpg',
      'https://rotadaspousadas.com.br/b.jpg',
    ])
    expect(ld.geo).toMatchObject({ latitude: -21.11, longitude: -44.17 })
    expect(ld.telephone).toBe('+5532999990000')
    expect(ld.checkinTime).toBe('14:00:00')
    expect(ld.checkoutTime).toBe('12:00:00')
    expect(ld.address).toMatchObject({ streetAddress: 'Rua Direita, 10', postalCode: '36325-000' })
    expect(ld.sameAs).toEqual(['https://www.instagram.com/chaleteste/'])
    expect(JSON.stringify(ld.makesOffer)).toContain('"price":500')
  })

  it('campo vazio ou estranho fica de fora', () => {
    const ld = pousadaJsonLd({
      ...pousada,
      pricePerNight: 0,
      contactPhone: '123',
      checkinTime: 'depois do almoço',
    }) as Record<string, unknown>
    for (const key of ['geo', 'telephone', 'checkinTime', 'makesOffer', 'priceRange', 'sameAs']) {
      expect(ld).not.toHaveProperty(key)
    }
    expect(ld.address).not.toHaveProperty('streetAddress')
  })
})
