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

const homeTitle = `Pousadas com reserva direta no Brasil | ${siteConfig.name}`

/** Base metadata shared by the whole site (merged/overridden per route). */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    // "pousadas" logo no começo: é o que as pessoas digitam no Google.
    default: homeTitle,
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
    title: homeTitle,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
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
      // Imagem: app/pousada/[slug]/opengraph-image.tsx (foto, nome, cidade e preço).
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/** Só dígitos, com DDI do Brasil — formato que o Google lê em `telephone`. */
function schemaPhone(raw?: string): string | undefined {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length < 10) return undefined
  return digits.startsWith('55') && digits.length >= 12 ? `+${digits}` : `+55${digits}`
}

/** "14:00" → "14:00:00" (schema.org Time); qualquer outra coisa fica de fora. */
function schemaTime(raw?: string): string | undefined {
  const m = (raw ?? '').trim().match(/^(\d{1,2})[:h](\d{2})?$/)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2] ?? '0')
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
}

/**
 * schema.org LodgingBusiness da pousada. Cada campo só entra quando a pousada
 * preencheu de verdade: o Google trata dado vazio ou inventado como erro.
 */
export function pousadaJsonLd(pousada: Pousada) {
  const url = absoluteUrl(`/pousada/${pousada.slug}`)
  const images = [pousada.image, ...(pousada.gallery ?? [])]
    .filter(Boolean)
    .slice(0, 8)
    // Fotos do storage já vêm com https://; só caminho local ganha o domínio.
    .map((src) => (/^https?:\/\//.test(src) ? src : absoluteUrl(src)))
  const telephone = schemaPhone(pousada.contactPhone) ?? schemaPhone(pousada.whatsapp)
  const checkinTime = schemaTime(pousada.checkinTime)
  const checkoutTime = schemaTime(pousada.checkoutTime)
  const point = pousada.coordinates
  const instagram = (pousada.instagram ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${url}#pousada`,
    name: pousada.name,
    description: pousada.description,
    image: images.length > 1 ? images : images[0],
    url,
    address: {
      '@type': 'PostalAddress',
      ...(pousada.address?.trim() ? { streetAddress: pousada.address.trim() } : {}),
      addressLocality: pousada.city,
      addressRegion: pousada.state,
      ...(pousada.cep?.trim() ? { postalCode: pousada.cep.trim() } : {}),
      addressCountry: 'BR',
    },
    ...(point
      ? {
          geo: { '@type': 'GeoCoordinates', latitude: point.lat, longitude: point.lng },
          hasMap: `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`,
        }
      : {}),
    ...(telephone ? { telephone } : {}),
    ...(checkinTime ? { checkinTime } : {}),
    ...(checkoutTime ? { checkoutTime } : {}),
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
    ...(pousada.pricePerNight > 0
      ? {
          priceRange: `A partir de R$ ${pousada.pricePerNight}`,
          makesOffer: {
            '@type': 'Offer',
            name: 'Diária',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: pousada.pricePerNight,
              priceCurrency: 'BRL',
              unitText: 'noite',
            },
            url,
          },
        }
      : {}),
    currenciesAccepted: 'BRL',
    paymentAccepted: 'Pix, cartão de crédito',
    amenityFeature: pousada.tags.map((t) => ({
      '@type': 'LocationFeatureSpecification',
      name: t,
      value: true,
    })),
    ...(instagram ? { sameAs: [`https://www.instagram.com/${instagram}/`] } : {}),
    containedInPlace: {
      '@type': 'City',
      name: `${pousada.city}, ${pousada.state}`,
    },
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
