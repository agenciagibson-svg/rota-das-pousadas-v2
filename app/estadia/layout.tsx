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
  themeColor: '#0F766E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function EstadiaLayout({ children }: { children: React.ReactNode }) {
  return children
}
