/**
 * Design tokens for TypeScript/JS (Motion animations, charts, inline styles).
 * Mirror of `styles/tokens.css`. NEVER hardcode durations, easing, spacing,
 * radius or shadows — import from here. See `docs/DesignFoundations.md`.
 */

/** MOTION — the only allowed durations (seconds, for Motion/Framer). */
export const duration = {
  hover: 0.15,
  fade: 0.22,
  modal: 0.28,
  drawer: 0.32,
  reveal: 0.5,
  page: 0.35,
} as const

/** Duration in milliseconds (for CSS/inline). */
export const durationMs = {
  hover: 150,
  fade: 220,
  modal: 280,
  drawer: 320,
  reveal: 500,
  page: 350,
} as const

/** Easing curves. `standard` is the brand signature. */
export const easing = {
  standard: [0.22, 1, 0.36, 1],
  out: [0, 0, 0.2, 1],
  inOut: [0.4, 0, 0.2, 1],
} as const

/** SPACING — the only allowed step values (px) and their Tailwind step. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
  24: 96,
  32: 128,
} as const

/** RADIUS — official scale (Tailwind rounded-* utilities). */
export const radius = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'] as const
export type Radius = (typeof radius)[number]

/** SHADOWS — semantic elevation names (Tailwind shadow-* utilities). */
export const shadow = ['surface', 'card', 'elevated', 'floating', 'modal', 'premium'] as const
export type Shadow = (typeof shadow)[number]

/** GRID — columns per breakpoint. */
export const grid = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
  gap: 24,
  gapLg: 32,
} as const

/** ICONS — global rules. */
export const icon = {
  library: 'lucide',
  strokeWidth: 2,
  size: 24,
} as const

export const zIndex = {
  base: 0,
  dropdown: 20,
  sticky: 30,
  drawer: 40,
  overlay: 45,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
} as const

/**
 * Brand color tokens (hex mirror of the CSS custom properties in
 * `app/globals.css`). Paleta da marca out/2026 — ver docs/Marca.md.
 */
export const brand = {
  ipe: '#f4b42a',
  breu: '#0f1716',
  grafite: '#4f5955',
  liquen: '#a9b3ae',
  pedra: '#c9d0cc',
  neblina: '#eef1ef',
  // Nomes antigos, remapeados para a paleta nova.
  forest: '#0f1716',
  ocean: '#4f5955',
  sunset: '#f97316',
  gold: '#f4b42a',
  sand: '#e2e7e4',
  linen: '#eef1ef',
  stoneDeep: '#0f1716',
} as const

export type Duration = keyof typeof duration
export type Easing = keyof typeof easing
