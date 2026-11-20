import { describe, expect, it } from 'vitest'
import type { Pousada } from '@/types'
import { pousadaFaq } from './faq'
import { STAY_TYPES, hasStayType, stayType } from './amenities'

const base: Pousada = {
  slug: 'p',
  name: 'Chalés da Serra',
  city: 'Monte Verde',
  state: 'MG',
  image: '/a.jpg',
  gallery: [],
  rating: 0,
  reviews: 0,
  pricePerNight: 0,
  tags: [],
  description: '',
  instagram: '',
}

describe('tipos de estadia', () => {
  it('reconhece palavra inteira, sem acento', () => {
    const pet = stayType('aceita-pet')!
    expect(hasStayType({ tags: ['Pet Friendly'] }, pet)).toBe(true)
    expect(hasStayType({ tags: ['Aceita cachorros'] }, pet)).toBe(true)
    expect(hasStayType({ tags: ['Petiscos', 'Carpete'] }, pet)).toBe(false)
    expect(hasStayType({ tags: ['Café da Manhã'] }, stayType('com-cafe-da-manha')!)).toBe(true)
    expect(hasStayType({ tags: ['Café'] }, stayType('com-cafe-da-manha')!)).toBe(false)
    expect(hasStayType({ tags: ['Ideal para casais'] }, stayType('romanticas')!)).toBe(true)
  })

  it('slugs únicos e em formato de URL', () => {
    const slugs = STAY_TYPES.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z-]+$/)
  })
})

describe('perguntas frequentes da pousada', () => {
  it('sem dado, só onde fica e como reservar', () => {
    expect(pousadaFaq(base).map((f) => f.question)).toEqual([
      'Onde fica a pousada Chalés da Serra?',
      'Como reservar a pousada Chalés da Serra?',
    ])
  })

  it('com dados, responde horário, preço, pet, café, cancelamento e endereço', () => {
    const faq = pousadaFaq({
      ...base,
      name: 'Pousada do Sol',
      checkinTime: '14:00',
      checkoutTime: '12:00',
      pricePerNight: 420,
      tags: ['Pet Friendly', 'Café da manhã', 'Piscina'],
      cancellationPolicy: 'Cancelamento grátis até 7 dias antes.',
      address: 'Rua A, 1',
    })
    const text = JSON.stringify(faq)
    expect(faq[0]!.question).toBe('Qual o horário de check-in e check-out da Pousada do Sol?')
    expect(faq[0]!.answer).toBe(
      'Na Pousada do Sol, o check-in é a partir das 14:00 e o check-out é até as 12:00.',
    )
    expect(text).toContain('R$ 420')
    expect(text).toContain('A Pousada do Sol aceita pet?')
    expect(text).toContain('serve café da manhã?')
    expect(text).toContain('tem piscina?')
    expect(text).toContain('Cancelamento grátis até 7 dias antes.')
    expect(text).toContain('no endereço Rua A, 1')
  })
})

describe('páginas por tipo', () => {
  it('monta só tipos com pousada e indexa com 2+', async () => {
    const { buildStayTypePages, stayTypeIndexable } = await import('./amenities')
    const pages = buildStayTypePages(
      [
        { ...base, slug: 'a', tags: ['Pet friendly', 'Piscina'] },
        { ...base, slug: 'b', city: 'Tiradentes', tags: ['Aceita pet'] },
        { ...base, slug: 'c', tags: [] },
      ],
      (c, s) => `${c}-${s}`.toLowerCase().replace(/ /g, '-'),
    )
    expect(pages.map((p) => [p.type.slug, p.pousadas.length])).toEqual([
      ['aceita-pet', 2],
      ['com-piscina', 1],
    ])
    expect(pages[0]!.cities.map((c) => c.slug)).toEqual(['monte-verde-mg', 'tiradentes-mg'])
    expect(stayTypeIndexable(pages[0]!)).toBe(true)
    expect(stayTypeIndexable(pages[1]!)).toBe(false)
  })
})
