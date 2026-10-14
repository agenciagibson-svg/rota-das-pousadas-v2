import { THEME_COLOR } from '@/features/estadia/theme'

/** Manifesto do app da estadia (instalável na tela inicial). */
export function GET() {
  const manifest = {
    name: 'Minha estadia · Rota das Pousadas',
    short_name: 'Minha estadia',
    description: 'Peça, veja sua conta e fale com a pousada durante a estadia.',
    id: '/estadia',
    start_url: '/estadia',
    scope: '/estadia',
    display: 'standalone',
    display_override: ['standalone'],
    orientation: 'portrait',
    // Fundo da abertura no Android; no iPhone a abertura vem das imagens
    // `apple-touch-startup-image` (claro e escuro) declaradas no layout.
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
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
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
