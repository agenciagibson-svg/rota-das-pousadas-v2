import { Analytics } from '@vercel/analytics/next'
import type { Viewport } from 'next'
import { Manrope, Fraunces } from 'next/font/google'
import './globals.css'
import { baseMetadata, organizationJsonLd } from '@/lib/seo'
import { JsonLd } from '@/components/seo/json-ld'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  style: ['normal', 'italic'],
})

export const metadata = baseMetadata

export const viewport: Viewport = {
  themeColor: '#0F766E',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${fraunces.variable} bg-background`}>
      <body className="font-sans antialiased">
        <JsonLd data={organizationJsonLd()} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
