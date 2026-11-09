import type { Metadata } from 'next'
import type { Pousada } from '@/types'

function cleanUrl(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\/$/, '')
}

/**
 * Central SEO configuration and helpers. Set NEXT_PUBLIC_SITE_URL in the
 * environment (e.g. https://rotadaspousadas.com.br) for correct canonical /
 * Open Graph URLs; falls back to a sensible default in development.
 */
export const siteConfig = {
  name: 'Rota das Pousadas',
  shortName: 'Rota',
  description:
    'Rota das Pousadas: pousadas independentes com reserva direta, sem intermediário. Escolha seu refúgio na serra, praia, cachoeiras e natureza e pague com Pix ou cartão.',
  /** Outros nomes que as pessoas digitam para achar o site (WebSite.alternateName). */
  alternateNames: ['Rota Pousadas', 'Rota das Pousadas Brasil', 'rotadaspousadas.com.br'],
  /**
   * Perfis oficiais da marca (Organization.sameAs). Ajudam o Google a ligar o
   * site às redes. Preencha só com perfis que existem e são da Rota.
   */
  sameAs: ['https://www.instagram.com/rotadaspousadasoficial/'] as string[],
  url: cleanUrl(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rotadaspousadas.com.br'),
  locale: 'pt_BR',
  themeColor: '#0F1716',
  ogImage: '/images/hero.png',
  twitter: '@rotadaspousadas',
} as const

export function absoluteUrl(path = '') {
  return `${siteConfig.url}${path.startsWith('/') ? path : `/${path}`}`
}

/** Base metadata shared by the whole site (merged/overridden per route). */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Cada destino tem uma história`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  generator: 'Next.js',
  keywords: [
    'Rota das Pousadas',
    'rota pousadas',
    'reserva direta pousada',
    'pousadas',
    'viagem',
    'Brasil',
    'serra',
    'praia',
    'ecoturismo',
    'refúgios',
    'hospedagem',
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Cada destino tem uma história`,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — Cada destino tem uma história`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  // Search Console: defina NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION na Vercel.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png' }],
  },
  manifest: '/site.webmanifest',
}

/** Per-pousada metadata for the detail route. */
export function pousadaMetadata(pousada: Pousada): Metadata {
  const title = `${pousada.name} — ${pousada.city}, ${pousada.state}`
  const description = pousada.description.slice(0, 155)
  const path = `/pousada/${pousada.slug}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: absoluteUrl(path),
      title,
      description,
      images: [{ url: pousada.image, width: 1200, height: 630, alt: pousada.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [pousada.image],
    },
  }
}

/** schema.org LodgingBusiness structured data for a pousada. */
export function pousadaJsonLd(pousada: Pousada) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: pousada.name,
    description: pousada.description,
    image: absoluteUrl(pousada.image),
    url: absoluteUrl(`/pousada/${pousada.slug}`),
    address: {
      '@type': 'PostalAddress',
      addressLocality: pousada.city,
      addressRegion: pousada.state,
      addressCountry: 'BR',
    },
    // Sem avaliação real, nada de nota: o Google trata nota zerada como dado inválido.
    ...(pousada.reviews > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: pousada.rating,
            reviewCount: pousada.reviews,
            bestRating: 5,
          },
        }
      : {}),
    priceRange: `R$ ${pousada.pricePerNight}`,
    amenityFeature: pousada.tags.map((t) => ({ '@type': 'LocationFeatureSpecification', name: t })),
  }
}

/**
 * Organização + site (schema.org) na raiz. O WebSite com `alternateName` e a
 * busca interna ajudam o Google a mostrar "Rota das Pousadas" como nome do
 * site e a ligar a marca a buscas parecidas ("rota pousadas").
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteConfig.url}/#organizacao`,
        name: siteConfig.name,
        url: siteConfig.url,
        // Raster quadrado: o Google não usa SVG como logo.
        logo: absoluteUrl('/icon-512.png'),
        description: siteConfig.description,
        ...(siteConfig.sameAs.length ? { sameAs: siteConfig.sameAs } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#site`,
        name: siteConfig.name,
        alternateName: siteConfig.alternateNames,
        url: siteConfig.url,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${siteConfig.url}/#organizacao` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteConfig.url}/pousadas?busca={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}
