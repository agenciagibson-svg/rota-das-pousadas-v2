/**
 * Cara da pousada no app da estadia (0110). A cor é escolhida numa paleta fixa
 * — todas claras o bastante para o texto escuro do app (Breu) ficar legível,
 * então o contraste não depende de quem escolhe. Mesmas chaves do check da
 * coluna `pousada_guest_settings.app_accent`.
 */
export const APP_ACCENTS = {
  ipe: { label: 'Ipê (cor da Rota)', hex: '#f4b42a' },
  pitanga: { label: 'Pitanga', hex: '#f59e83' },
  pessego: { label: 'Pêssego', hex: '#f7b78a' },
  areia: { label: 'Areia', hex: '#e6cf9e' },
  capim: { label: 'Capim', hex: '#a7d38a' },
  menta: { label: 'Menta', hex: '#8fdcc4' },
  ceu: { label: 'Céu', hex: '#8cc8ef' },
  lavanda: { label: 'Lavanda', hex: '#c4b1ee' },
} as const

export type AppAccent = keyof typeof APP_ACCENTS

/** Texto escuro do app, usado por cima da cor. */
export const ACCENT_INK = '#0f1716'

export function isAppAccent(value: unknown): value is AppAccent {
  return typeof value === 'string' && Object.hasOwn(APP_ACCENTS, value)
}

/** Cor da pousada, ou `null` para ficar com a da Rota. */
export function accentHex(value: string | null | undefined): string | null {
  return isAppAccent(value) && value !== 'ipe' ? APP_ACCENTS[value].hex : null
}

function channel(c: number): number {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

/** Contraste WCAG entre duas cores #rrggbb. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
