import { absoluteUrl } from '@/lib/seo'
import { destinationTitle, type CityDestination, type FaqItem } from './destinos'

/**
 * Dados estruturados da página de destino: trilha (Início › Destinos ›
 * cidade), a lista das pousadas e as perguntas frequentes.
 */
export function destinationJsonLd(d: CityDestination, faq: FaqItem[]) {
  const url = absoluteUrl(`/destinos/${d.slug}`)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Destinos', item: absoluteUrl('/destinos') },
          { '@type': 'ListItem', position: 3, name: `${d.city}, ${d.state}`, item: url },
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
