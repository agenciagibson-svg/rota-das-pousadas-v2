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
    'O maior ecossistema digital de pousadas do Brasil. Encontre refúgios exclusivos na serra, praia, cachoeiras e natureza. Toda grande viagem começa por uma rota.',
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
    creator: siteConfig.twitter,
  },
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
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: pousada.rating,
      reviewCount: pousada.reviews,
      bestRating: 5,
    },
    priceRange: `R$ ${pousada.pricePerNight}`,
    amenityFeature: pousada.tags.map((t) => ({ '@type': 'LocationFeatureSpecification', name: t })),
  }
}

/** Organization structured data for the site root. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl('/icon.svg'),
    description: siteConfig.description,
  }
}
