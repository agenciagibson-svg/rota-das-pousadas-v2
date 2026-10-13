import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { RegisterStayServiceWorker } from '@/features/estadia/components/register-stay-sw'
import { StayThemeProvider } from '@/features/estadia/components/stay-theme'
import { splashStartupImages } from '@/features/estadia/pwa'
import { stayThemeBootScript, THEME_COLOR } from '@/features/estadia/theme'

export const metadata: Metadata = {
  title: 'Minha estadia',
  description: 'Peça, veja sua conta e fale com a pousada durante a estadia.',
  // Manifesto próprio: "Adicionar à Tela de Início" abre direto no app da estadia.
  manifest: '/estadia/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Minha estadia',
    statusBarStyle: 'default',
    startupImage: splashStartupImages(),
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Barra do sistema na cor do fundo do app, clara ou escura conforme o celular
  // (com escolha manual, o app troca as duas na hora — ver stay-theme.tsx).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.dark },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/**
 * Mesma tipografia do site (Figtree + Funnel Display, do layout raiz). O app
 * tem tema claro e escuro: `data-stay-app` recebe `data-theme` pelo script de
 * abertura (antes da primeira pintura) e depois pelo StayThemeProvider.
 */
export default async function EstadiaLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <div data-stay-app suppressHydrationWarning className="bg-app text-app-ink min-h-dvh">
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: stayThemeBootScript }}
      />
      <StayThemeProvider>{children}</StayThemeProvider>
      <RegisterStayServiceWorker />
    </div>
  )
}
