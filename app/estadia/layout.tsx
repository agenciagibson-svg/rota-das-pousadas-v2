import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Minha estadia',
  description: 'Peça, veja sua conta e fale com a pousada durante a estadia.',
  // Manifesto próprio: "Adicionar à tela inicial" abre direto no app da estadia.
  manifest: '/estadia/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Minha estadia', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#eef1ef',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Mesma tipografia do site (Figtree + Funnel Display, herdadas do layout raiz):
// o app da estadia tem cara de app de pedidos, mas é a mesma marca.
export default function EstadiaLayout({ children }: { children: React.ReactNode }) {
  return children
}
