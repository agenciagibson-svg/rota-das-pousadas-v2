import { absoluteUrl } from '@/lib/seo'
import {
  destinationTitle,
  stateTitle,
  type CityDestination,
  type FaqItem,
  type StateDestination,
} from './destinos'

/**
 * Dados estruturados da página de destino: trilha (Início › Destinos ›
 * cidade), a lista das pousadas e as perguntas frequentes.
 */
export function destinationJsonLd(
  d: CityDestination,
  faq: FaqItem[],
  /** Página do estado, quando ela vai para o Google. */
  stateHref?: string,
) {
  const url = absoluteUrl(`/destinos/${d.slug}`)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Destinos', item: absoluteUrl('/destinos') },
          ...(stateHref
            ? [{ '@type': 'ListItem', position: 3, name: d.state, item: absoluteUrl(stateHref) }]
            : []),
          {
            '@type': 'ListItem',
            position: stateHref ? 4 : 3,
            name: `${d.city}, ${d.state}`,
            item: url,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: destinationTitle(d),
        url,
        numberOfItems: d.pousadas.length,
        itemListElement: d.pousadas.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl(`/pousada/${p.slug}`),
          name: p.name,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  }
}

/** Trilha e lista de cidades da página do estado. */
export function stateJsonLd(s: StateDestination) {
  const url = absoluteUrl(`/destinos/${s.slug}`)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Destinos', item: absoluteUrl('/destinos') },
          { '@type': 'ListItem', position: 3, name: s.name, item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: stateTitle(s),
        url,
        numberOfItems: s.cities.length,
        itemListElement: s.cities.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl(`/destinos/${c.slug}`),
          name: `Pousadas em ${c.city}, ${c.state}`,
        })),
      },
    ],
  }
}
