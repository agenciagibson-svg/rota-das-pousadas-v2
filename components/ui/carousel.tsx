'use client'

import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Scroll-snap carousel with accessible prev/next controls.
 * Children are rendered as horizontally snapping items; no external deps.
 */
export function Carousel({
  children,
  className,
  itemClassName,
  ariaLabel = 'Carrossel',
}: {
  children: ReactNode
  className?: string
  itemClassName?: string
  ariaLabel?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  const items = Array.isArray(children) ? children : [children]

  return (
    <div className={cn('relative', className)} role="region" aria-label={ariaLabel} aria-roledescription="carrossel">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
      >
        {items.map((child, i) => (
          <div key={i} className={cn('snap-start shrink-0', itemClassName)}>
            {child}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Anterior"
        className="glass absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full text-foreground shadow-md transition hover:brightness-105 md:flex"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Próximo"
        className="glass absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full text-foreground shadow-md transition hover:brightness-105 md:flex"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
