import type { Pousada } from '@/types'

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Prepara o texto uma vez por catálogo, reutilizando-o entre mudanças de filtros. */
export function prepareCatalog(pousadas: Pousada[]) {
  return pousadas.map((pousada) => ({
    pousada,
    text: normalizeSearch(
      `${pousada.name} ${pousada.city} ${pousada.state} ${pousada.description} ${pousada.tags.join(' ')}`,
    ),
    baseScore: pousada.rating * 12 + Math.min(pousada.reviews, 200) / 10,
  }))
}

export function recommendPousadas(
  catalog: ReturnType<typeof prepareCatalog>,
  filters: { terms: string[]; maxPrice: number; premium: boolean; destination: string },
) {
  const destination = normalizeSearch(filters.destination)
  const terms = filters.terms.map(normalizeSearch)
  const best: Array<{ pousada: Pousada; score: number }> = []

  for (const { pousada, text, baseScore } of catalog) {
    let score = baseScore
    for (const term of terms) if (text.includes(term)) score += 18
    if (destination && text.includes(destination)) score += 40
    if (pousada.pricePerNight <= filters.maxPrice) score += 28
    if (filters.premium && pousada.pricePerNight >= 500) score += 16
    if (!filters.premium && pousada.pricePerNight > filters.maxPrice) {
      score -= Math.min(34, (pousada.pricePerNight - filters.maxPrice) / 10)
    }
    // Só precisamos dos três primeiros; empates preservam a ordem do catálogo.
    const position = best.findIndex((item) => score > item.score)
    if (position >= 0) best.splice(position, 0, { pousada, score })
    else if (best.length < 3) best.push({ pousada, score })
    if (best.length > 3) best.pop()
  }
  return best
}
