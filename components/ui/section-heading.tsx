import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The eyebrow + serif title (+ optional description) block that opens
 * every landing section. Standardizes typography and spacing so all
 * sections stay visually consistent.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  as: Title = 'h2',
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </span>
      )}
      <Title className="mt-3 text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
        {title}
      </Title>
      {description && (
        <p className="mt-4 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
