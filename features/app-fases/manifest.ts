import { siteConfig } from '@/lib/seo'
import { brand } from '@/lib/design-tokens'

/**
 * Manifesto do app único da Rota (loja → estadia → loja). Um só app na tela
 * inicial: abre sempre em `/app`, que decide a fase (features/app-fases/phase.ts).
 *
 * - `/site.webmanifest` (id `/`): instalação a partir de qualquer página — do
 *   site ou do app da estadia.
 * - `/estadia/manifest.webmanifest` (id `/estadia`): só para quem instalou o
 *   antigo "Minha estadia"; o navegador atualiza o app instalado para este
 *   mesmo comportamento. Novas instalações não usam mais este id.
 */
export function appManifest(id: '/' | '/estadia') {
  return {
    id,
    name: siteConfig.name,
    short_name: siteConfig.name,
    description:
      'Reserve pousadas e, durante a estadia, peça, veja sua conta e fale com a pousada.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone'],
    orientation: 'portrait',
    background_color: brand.neblina,
    theme_color: brand.neblina,
    lang: 'pt-BR',
    dir: 'ltr',
    categories: ['travel', 'lifestyle'],
    prefer_related_applications: false,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}

export function manifestResponse(id: '/' | '/estadia'): Response {
  return new Response(JSON.stringify(appManifest(id)), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
