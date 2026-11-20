import { describe, expect, it } from 'vitest'
import type { Pousada } from '@/types'
import {
  citySlug,
  destinationDescription,
  destinationFaq,
  destinationIntro,
  destinationPath,
  groupByCity,
  withCityPages,
  cityPhoto,
} from './destinos'
import type { Destination } from '@/types'

function pousada(over: Partial<Pousada>): Pousada {
  return {
    slug: 'p',
    name: 'Pousada',
    city: 'Tiradentes',
    state: 'MG',
    image: '/a.jpg',
    gallery: [],
    rating: 0,
    reviews: 0,
    pricePerNight: 300,
    tags: [],
    description: '',
    instagram: '',
    ...over,
  }
}

describe('citySlug', () => {
  it('junta cidade e UF sem acento', () => {
    expect(citySlug('São Thomé das Letras', 'MG')).toBe('sao-thome-das-letras-mg')
    expect(destinationPath('Tiradentes', 'mg')).toBe('/destinos/tiradentes-mg')
  })
})

describe('groupByCity', () => {
  it('agrupa grafias da mesma cidade e separa cidades de mesmo nome em UFs diferentes', () => {
    const groups = groupByCity([
      pousada({ slug: 'a', city: 'São Thomé', state: 'MG' }),
      pousada({ slug: 'b', city: 'sao thomé', state: 'mg' }),
      pousada({ slug: 'c', city: 'Bonito', state: 'MS' }),
      pousada({ slug: 'd', city: 'Bonito', state: 'PE' }),
    ])
    expect(groups.map((g) => [g.slug, g.pousadas.length])).toEqual([
      ['sao-thome-mg', 2],
      ['bonito-ms', 1],
      ['bonito-pe', 1],
    ])
    expect(groups[0]!.state).toBe('MG')
  })

  it('deixa de fora pousada sem cidade ou UF', () => {
    expect(groupByCity([pousada({ city: ' ', state: 'MG' }), pousada({ state: '' })])).toEqual([])
  })

  it('calcula faixa de preço, nota ponderada e comodidades mais comuns', () => {
    const [d] = groupByCity([
      pousada({
        slug: 'a',
        name: 'A',
        pricePerNight: 250,
        rating: 5,
        reviews: 1,
        tags: ['Piscina', 'Café'],
      }),
      pousada({
        slug: 'b',
        name: 'B',
        pricePerNight: 600,
        rating: 4,
        reviews: 3,
        tags: ['piscina'],
      }),
      pousada({ slug: 'c', name: 'C', pricePerNight: 0, tags: [] }),
    ])
    expect(d!.priceFrom).toBe(250)
    expect(d!.priceTo).toBe(600)
    expect(d!.rating).toBe(4.3)
    expect(d!.reviews).toBe(4)
    expect(d!.topTags).toEqual(['Piscina', 'Café'])
    // A mais avaliada abre a lista.
    expect(d!.pousadas[0]!.slug).toBe('b')
  })

  it('sem avaliação, a nota fica nula', () => {
    expect(groupByCity([pousada({})])[0]!.rating).toBeNull()
  })
})

describe('textos da página', () => {
  it('descrição e abertura usam só os dados', () => {
    const [d] = groupByCity([
      pousada({ pricePerNight: 300, tags: ['Café da manhã'] }),
      pousada({ slug: 'b', pricePerNight: 450 }),
    ])
    expect(destinationDescription(d!)).toContain('2 pousadas em Tiradentes (MG)')
    expect(destinationDescription(d!)).toContain('R$ 300')
    expect(destinationIntro(d!)).toContain('de R$ 300 a R$ 450')
    expect(destinationIntro(d!)).toContain('Café da manhã')
  })

  it('perguntas sobre pet e avaliação só aparecem quando há dado', () => {
    const [semDado] = groupByCity([pousada({ pricePerNight: 0 })])
    const perguntas = destinationFaq(semDado!).map((f) => f.question)
    expect(perguntas).toHaveLength(2)
    expect(perguntas.join(' ')).not.toMatch(/pet|avalia|diária/)

    const [comDado] = groupByCity([
      pousada({ name: 'Recanto', tags: ['Aceita pet'], rating: 4.8, reviews: 12 }),
    ])
    const faq = destinationFaq(comDado!)
    expect(faq.find((f) => f.question.includes('pet'))?.answer).toContain('Recanto')
    expect(faq.find((f) => f.question.includes('avaliações'))?.answer).toContain(
      'nota 4.8 em 12 avaliações',
    )
  })

  it('não confunde palavra que contém "pet" com aceitar pet', () => {
    const [d] = groupByCity([pousada({ tags: ['Petiscos no bar', 'Carpete'] })])
    expect(destinationFaq(d!).some((f) => f.question.includes('pet'))).toBe(false)
  })
})

describe('withCityPages', () => {
  const curated = (name: string, state: string): Destination => ({
    slug: name.toLowerCase(),
    name,
    state,
    image: '/d.jpg',
    pousadas: 9,
    rating: 4.9,
    priceFrom: 999,
    season: [],
  })

  it('liga o destino curado à página da cidade com os números reais', () => {
    const cities = groupByCity([
      pousada({ city: 'Monte Verde', state: 'MG', pricePerNight: 410, rating: 4.5, reviews: 2 }),
    ])
    const [mv, outro] = withCityPages(
      [curated('Monte Verde', 'MG'), curated('Bonito', 'MS')],
      cities,
    )
    expect(mv).toMatchObject({
      href: '/destinos/monte-verde-mg',
      pousadas: 1,
      priceFrom: 410,
      rating: 4.5,
    })
    // Sem pousada na cidade: nada de contagem curada.
    expect(outro!.href).toBeUndefined()
    expect(outro!.pousadas).toBe(0)
  })

  it('cidade sem avaliação zera a nota curada', () => {
    const cities = groupByCity([pousada({ city: 'Bonito', state: 'MS' })])
    expect(withCityPages([curated('Bonito', 'MS')], cities)[0]!.rating).toBe(0)
  })
})

describe('cityPhoto', () => {
  it('usa a foto do destino cadastrado com o mesmo nome e UF', () => {
    const [city] = groupByCity([pousada({ city: 'Tiradentes', state: 'MG' })])
    const d = (name: string, state: string, image: string) =>
      ({
        slug: 'x',
        name,
        state,
        image,
        pousadas: 0,
        rating: 0,
        priceFrom: 0,
        season: [],
      }) as Destination
    expect(cityPhoto(city!, [d('Tiradentes', 'MG', '/t.jpg')])).toBe('/t.jpg')
    expect(cityPhoto(city!, [d('Tiradentes', 'SP', '/t.jpg')])).toBeNull()
    expect(cityPhoto(city!, [d('Tiradentes', 'MG', ' ')])).toBeNull()
  })
})
