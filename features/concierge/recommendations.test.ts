import { describe, expect, it } from 'vitest'
import { pousadas } from '@/lib/data'
import { normalizeSearch, prepareCatalog, recommendPousadas } from './recommendations'

const filters = { terms: ['romantico', 'chale'], maxPrice: 600, premium: false, destination: '' }

describe('recomendações do concierge', () => {
  it('encontra destinos e interesses com ou sem acento', () => {
    const catalog = prepareCatalog([
      { ...pousadas[0], city: 'São Tomé', tags: ['Chalé romântico'] },
    ])
    const neutral = recommendPousadas(catalog, { ...filters, terms: [] })
    const matching = recommendPousadas(catalog, { ...filters, destination: '  SAO TOME  ' })
    expect(matching[0].score - neutral[0].score).toBe(76)
    expect(normalizeSearch('Café')).toBe('cafe')
  })

  it('retorna os mesmos três primeiros de uma ordenação completa, incluindo empates', () => {
    const catalog = prepareCatalog(
      Array.from({ length: 1000 }, (_, i) => ({
        ...pousadas[i % pousadas.length],
        slug: `pousada-${i}`,
        rating: i % 6,
        reviews: i % 201,
      })),
    )
    for (const premium of [false, true]) {
      const query = { ...filters, premium, maxPrice: premium ? Infinity : 600 }
      const expected = catalog
        .map(({ pousada, text, baseScore }) => {
          let score = baseScore
          for (const term of filters.terms) if (text.includes(term)) score += 18
          if (pousada.pricePerNight <= query.maxPrice) score += 28
          if (premium && pousada.pricePerNight >= 500) score += 16
          if (!premium && pousada.pricePerNight > query.maxPrice) {
            score -= Math.min(34, (pousada.pricePerNight - query.maxPrice) / 10)
          }
          return { pousada, score }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      expect(recommendPousadas(catalog, query)).toEqual(expected)
    }
  })

  it('preserva o catálogo e aceita catálogos vazios ou pequenos', () => {
    expect(recommendPousadas([], filters)).toEqual([])
    const catalog = prepareCatalog(pousadas.slice(0, 2))
    const before = structuredClone(catalog)
    expect(recommendPousadas(catalog, filters)).toHaveLength(2)
    expect(catalog).toEqual(before)
  })
})
