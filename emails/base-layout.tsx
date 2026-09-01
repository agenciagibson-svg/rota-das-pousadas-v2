/**
 * Base transactional-email layout.
 *
 * Framework-agnostic React that renders to an HTML string (e.g. with
 * `react-dom/server` or `@react-email/render`) when an email provider is wired.
 * No emails are sent yet — this establishes brand-consistent structure and
 * inline styles (email clients ignore external CSS / design tokens).
 */
import type { ReactNode } from 'react'

const BRAND = {
  forest: '#0f766e',
  linen: '#f8f6f1',
  stone: '#1f2420',
  muted: '#6b6459',
}

export function BaseEmailLayout({
  previewText,
  children,
}: {
  previewText?: string
  children: ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: BRAND.linen, fontFamily: 'Arial, sans-serif' }}>
        {previewText && (
          <span style={{ display: 'none', opacity: 0, color: 'transparent' }}>{previewText}</span>
        )}
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
          <tbody>
            <tr>
              <td align="center" style={{ padding: '32px 16px' }}>
                <table
                  width={560}
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                  style={{ backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' }}
                >
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: BRAND.forest, padding: '20px 28px', color: BRAND.linen, fontSize: 18, fontWeight: 700 }}>
                        Rota das Pousadas
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: 28, color: BRAND.stone, fontSize: 15, lineHeight: 1.6 }}>
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '20px 28px', color: BRAND.muted, fontSize: 12, borderTop: '1px solid #e4ddd0' }}>
                        © {new Date().getFullYear()} Rota das Pousadas. Cada destino tem uma história.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
