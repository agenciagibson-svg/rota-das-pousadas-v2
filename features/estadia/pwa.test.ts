import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SPLASH_DEVICES, splashFile, splashStartupImages } from './pwa'

/** Largura e altura de um PNG lidas do cabeçalho IHDR. */
function pngSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe('telas de abertura do app no iPhone', () => {
  it('cada aparelho tem versão clara e escura no tamanho exato em pixels', () => {
    for (const { slug, width, height, ratio } of SPLASH_DEVICES) {
      for (const theme of ['light', 'dark'] as const) {
        const file = path.join(process.cwd(), 'public', splashFile(slug, theme))
        expect(fs.existsSync(file), file).toBe(true)
        expect(pngSize(file)).toEqual({ width: width * ratio, height: height * ratio })
      }
    }
  })

  it('o iPhone 16 Pro Max (440×956 @3x) está coberto nos dois temas', () => {
    const media = splashStartupImages()
      .filter((s) => s.url.includes('iphone-16-pro-max'))
      .map((s) => s.media)
    expect(media).toHaveLength(2)
    expect(media.every((m) => m.includes('(device-width: 440px) and (device-height: 956px)'))).toBe(
      true,
    )
    expect(media.some((m) => m.includes('prefers-color-scheme: dark'))).toBe(true)
  })
})

describe('manifesto do app', () => {
  it('nenhum manifesto por arquivo na raiz encobre o do app da estadia', async () => {
    // Manifesto na raiz por arquivo (ou rota com esse nome) vence o
    // `metadata.manifest` dos layouts: o app instalado abria a home do site.
    for (const name of ['manifest.ts', 'manifest.json', 'manifest.webmanifest']) {
      expect(fs.existsSync(path.join(process.cwd(), 'app', name)), `app/${name}`).toBe(false)
    }
    const { metadata } = await import('@/app/estadia/layout')
    expect(metadata.manifest).toBe('/estadia/manifest.webmanifest')
  })
})
