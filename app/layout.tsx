import { Analytics } from '@vercel/analytics/next'
import type { Viewport } from 'next'
import { Figtree, Funnel_Display } from 'next/font/google'
import { connection } from 'next/server'
import './globals.css'
import { baseMetadata, organizationJsonLd } from '@/lib/seo'
import { isSupabaseConfigured } from '@/lib/env'
import { MotionProvider } from '@/components/motion-provider'
import { JsonLd } from '@/components/seo/json-ld'

// Marca (out/2026, docs/Marca.md): Funnel Display nos títulos, Figtree no
// texto e na interface. As duas sem serifa, variáveis, Google Fonts (OFL).
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})

const funnelDisplay = Funnel_Display({
  subsets: ['latin'],
  variable: '--font-funnel-display',
  display: 'swap',
})

export const metadata = baseMetadata

export const viewport: Viewport = {
  // Mesma cor do fundo das páginas (Neblina).
  themeColor: '#eef1ef',
  colorScheme: 'light',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Modo demonstração (sem Supabase): os repositórios usam dados de exemplo e
  // não leem cookies, então o Next pré-renderizaria as páginas no build, sem
  // requisição e sem nonce — e a CSP estrita (proxy.ts) bloquearia os scripts.
  // Com o Supabase configurado as páginas já são dinâmicas; aqui só igualamos
  // o modo demonstração a esse comportamento.
  if (!isSupabaseConfigured()) await connection()

  return (
    <html lang="pt-BR" className={`${figtree.variable} ${funnelDisplay.variable} bg-background`}>
      <body className="font-sans antialiased">
        <a
          href="#conteudo"
          className="bg-breu text-neblina focus-visible:ring-ipe sr-only z-[100] rounded-full px-5 py-3 text-sm font-semibold focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2"
        >
          Pular para o conteúdo
        </a>
        <JsonLd data={organizationJsonLd()} />
        <MotionProvider>{children}</MotionProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
