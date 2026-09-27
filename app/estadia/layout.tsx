import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'

// Fonte do app da estadia (visual de app de pedidos, diferente do site).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Minha estadia',
  description: 'Peça, veja sua conta e fale com a pousada durante a estadia.',
  // Manifesto próprio: "Adicionar à tela inicial" abre direto no app da estadia.
  manifest: '/estadia/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Minha estadia', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#f4f4f2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function EstadiaLayout({ children }: { children: React.ReactNode }) {
  return <div className={jakarta.className}>{children}</div>
}
