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
    orientation: 'portrait',
    background_color: '#f4f4f2',
    theme_color: '#f4f4f2',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
