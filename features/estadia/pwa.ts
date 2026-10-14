/**
 * Telas de abertura do app da estadia no iPhone (`apple-touch-startup-image`).
 * O iOS não usa o manifesto para isso: precisa de uma imagem por tamanho de
 * tela, em pixels reais, escolhida pela media query. Uma versão clara e uma
 * escura para cada aparelho. Imagens geradas em `public/pwa/estadia/`.
 */
export const SPLASH_DEVICES = [
  // iPhone 16 Pro Max (e 17 Pro Max): 440×956 pt @3x
  { slug: 'iphone-16-pro-max', width: 440, height: 956, ratio: 3 },
  // iPhone 16 Pro: 402×874 pt @3x
  { slug: 'iphone-16-pro', width: 402, height: 874, ratio: 3 },
  // iPhone 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max: 430×932 pt @3x
  { slug: 'iphone-16-plus', width: 430, height: 932, ratio: 3 },
  // iPhone 16, 15, 15 Pro, 14 Pro: 393×852 pt @3x
  { slug: 'iphone-16', width: 393, height: 852, ratio: 3 },
  // iPhone 16e, 14, 13, 12: 390×844 pt @3x
  { slug: 'iphone-14', width: 390, height: 844, ratio: 3 },
] as const

export type SplashTheme = 'light' | 'dark'

export function splashFile(slug: string, theme: SplashTheme): string {
  return `/pwa/estadia/splash-${slug}-${theme}.png`
}

export function splashStartupImages(): { url: string; media: string }[] {
  return SPLASH_DEVICES.flatMap(({ slug, width, height, ratio }) =>
    (['light', 'dark'] as const).map((theme) => ({
      url: splashFile(slug, theme),
      media:
        `screen and (device-width: ${width}px) and (device-height: ${height}px) and ` +
        `(-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and ` +
        `(prefers-color-scheme: ${theme})`,
    })),
  )
}
