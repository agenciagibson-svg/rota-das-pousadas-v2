import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/seo'
import {
  getCityDestinations,
  getPousadaSlugs,
  getStateDestinations,
  getStayTypePages,
} from '@/server/queries'
import { stayTypeIndexable } from '@/features/pousadas/amenities'
import { stateIndexable } from '@/features/destinos'

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
      url: `${siteConfig.url}/feriados`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
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
  const [destinations, states, typePages] = await Promise.all([
    getCityDestinations(),
    getStateDestinations(),
    getStayTypePages(),
  ])
  // Tipos de estadia (pet, piscina…): só com 2+ pousadas.
  const typeRoutes: MetadataRoute.Sitemap = typePages.filter(stayTypeIndexable).map((t) => ({
    url: `${siteConfig.url}/pousadas/${t.type.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))
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
        ...states.filter(stateIndexable).map((s) => ({
          url: `${siteConfig.url}/destinos/${s.slug}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        })),
      ]
    : []

  return [...staticRoutes, ...destinationRoutes, ...typeRoutes, ...pousadaRoutes]
}
