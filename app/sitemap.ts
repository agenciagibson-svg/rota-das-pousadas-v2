import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/seo'
import { getPousadaSlugs } from '@/server/queries'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteConfig.url, lastModified: now, changeFrequency: 'daily', priority: 1 },
  ]

  const slugs = await getPousadaSlugs()
  const pousadaRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${siteConfig.url}/pousada/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticRoutes, ...pousadaRoutes]
}
