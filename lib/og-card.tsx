import 'server-only'
import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/seo'

export const OG_SIZE = { width: 1200, height: 630 }

/**
 * Busca a foto e devolve como data URL — só JPEG/PNG, que o gerador de imagem
 * (satori) entende. WebP/AVIF ou falha de rede: sem foto, cai no fundo escuro.
 */
async function photoDataUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null
  try {
    let url = /^https?:\/\//.test(src) ? src : `${siteConfig.url}${src}`
    if (url.includes('images.unsplash.com')) {
      url = url.replace(/([?&])fm=[^&]*/g, '$1').replace(/[?&]$/, '')
      url += `${url.includes('?') ? '&' : '?'}fm=jpg&w=1200&h=630&fit=crop`
    }
    const res = await fetch(url, { headers: { Accept: 'image/jpeg,image/png' } })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
    if (type !== 'image/jpeg' && type !== 'image/png') return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > 6_000_000) return null
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Cartão de compartilhamento (WhatsApp, Facebook, X): foto de fundo, nome,
 * lugar e preço. Mesmo layout para pousada e cidade.
 */
export async function ogCard({
  photo,
  title,
  subtitle,
  badges,
}: {
  photo?: string | null
  title: string
  subtitle?: string
  badges?: string[]
}) {
  const bg = await photoDataUrl(photo)
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: '#0F1716',
        color: '#EEF1EF',
      }}
    >
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0, objectFit: 'cover' }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'linear-gradient(to top, rgba(15,23,22,0.92) 0%, rgba(15,23,22,0.55) 45%, rgba(15,23,22,0.15) 100%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '56px 64px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -0.5,
            backgroundColor: 'rgba(238,241,239,0.95)',
            color: '#0F1716',
            padding: '10px 22px',
            borderRadius: 999,
          }}
        >
          rota das pousadas
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 34 ? 60 : 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ display: 'flex', fontSize: 34, marginTop: 14, opacity: 0.9 }}>
              {subtitle}
            </div>
          ) : null}
          {badges?.length ? (
            <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
              {badges.map((b) => (
                <div
                  key={b}
                  style={{
                    display: 'flex',
                    fontSize: 28,
                    fontWeight: 600,
                    backgroundColor: '#F4B42A',
                    color: '#0F1716',
                    padding: '10px 22px',
                    borderRadius: 999,
                  }}
                >
                  {b}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    OG_SIZE,
  )
}
