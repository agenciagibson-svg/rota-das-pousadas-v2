import { Analytics } from '@vercel/analytics/next'
import type { Viewport } from 'next'
import { Figtree, Funnel_Display } from 'next/font/google'
import { connection } from 'next/server'
import './globals.css'
import { baseMetadata, organizationJsonLd } from '@/lib/seo'
import { isSupabaseConfigured } from '@/lib/env'
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
  themeColor: '#0F1716',
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
        <JsonLd data={organizationJsonLd()} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
