'use client'

import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * Varinha do concierge com traço multicolorido que gira devagar (o desenho é
 * o `WandSparkles` do lucide). As faíscas piscam em tempos diferentes. Com
 * "reduzir movimento" ligado, as cores ficam paradas. Cores em `--wand-*`
 * (app/globals.css). Decorativa: o texto ao lado dá o nome.
 */
export function MagicWand({ className }: { className?: string }) {
  const id = `wand-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const reduce = useReducedMotion()
  const stops = ['--wand-1', '--wand-2', '--wand-3', '--wand-4', '--wand-5', '--wand-1']

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${id})`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('magic-wand size-5 shrink-0', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          {stops.map((token, index) => (
            <stop
              key={index}
              offset={index / (stops.length - 1)}
              className={WAND_STOP_CLASS[token as keyof typeof WAND_STOP_CLASS]}
            />
          ))}
          {!reduce && (
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="3.2s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
      <path d="m14 7 3 3" />
      <g className="magic-wand-spark">
        <path d="M5 6v4" />
        <path d="M7 8H3" />
      </g>
      <g className="magic-wand-spark magic-wand-spark-2">
        <path d="M19 14v4" />
        <path d="M21 16h-4" />
      </g>
      <g className="magic-wand-spark magic-wand-spark-3">
        <path d="M10 2v2" />
        <path d="M11 3H9" />
      </g>
    </svg>
  )
}

const WAND_STOP_CLASS = {
  '--wand-1': '[stop-color:var(--wand-1)]',
  '--wand-2': '[stop-color:var(--wand-2)]',
  '--wand-3': '[stop-color:var(--wand-3)]',
  '--wand-4': '[stop-color:var(--wand-4)]',
  '--wand-5': '[stop-color:var(--wand-5)]',
} as const
