import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/seo'

/**
 * Manifesto do site, em `/site.webmanifest`. Não use `app/manifest.ts` nem uma
 * rota `app/manifest.webmanifest`: o Next trata os dois como manifesto da raiz
 * e ele vence o `metadata.manifest` de qualquer layout — o app da estadia
 * ficava com o manifesto do site e, na tela de início, abria a home em vez do
 * app. O link vem de `baseMetadata` (lib/seo.ts).
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#eef1ef',
    theme_color: siteConfig.themeColor,
    lang: 'pt-BR',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
