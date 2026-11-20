import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/seo'
import { getCityDestinations, getPousadaSlugs } from '@/server/queries'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteConfig.url, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${siteConfig.url}/pousadas`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/anunciar`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/termos`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${siteConfig.url}/privacidade`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${siteConfig.url}/excluir-conta`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  const slugs = await getPousadaSlugs()
  const pousadaRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${siteConfig.url}/pousada/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Páginas por cidade: só existem com pousada publicada, então entram todas.
  const destinations = await getCityDestinations()
  const destinationRoutes: MetadataRoute.Sitemap = destinations.length
    ? [
        {
          url: `${siteConfig.url}/destinos`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        ...destinations.map((d) => ({
          url: `${siteConfig.url}/destinos/${d.slug}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.85,
        })),
      ]
    : []

  return [...staticRoutes, ...destinationRoutes, ...pousadaRoutes]
}
