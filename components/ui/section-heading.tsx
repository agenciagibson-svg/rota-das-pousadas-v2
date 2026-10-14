import type { ReactNode } from 'react'
import { Marker } from '@/components/brand/logo'
import { cn } from '@/lib/utils'

/**
 * Rótulo + título (+ descrição opcional) que abre as seções. O rótulo vem em
 * frase normal, precedido pelo marcador da marca (o mesmo "o" da logo), e o
 * título usa a escala oficial em Funnel Display. `tone="dark"` para seções
 * sobre fundo Breu.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  tone = 'light',
  as: Title = 'h2',
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  className?: string
  tone?: 'light' | 'dark'
  as?: 'h1' | 'h2' | 'h3'
}) {
  const dark = tone === 'dark'
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && (
        <span className={cn('text-overline inline-flex items-center gap-2', dark && 'text-liquen')}>
          <Marker className={dark ? 'text-neblina' : 'text-foreground'} />
          {eyebrow}
        </span>
      )}
      <Title className={cn('text-h1 mt-3', dark ? 'text-neblina' : 'text-foreground')}>
        {title}
      </Title>
      {description && (
        <p
          className={cn(
            'mt-4 max-w-lg text-base leading-relaxed text-pretty',
            dark ? 'text-liquen' : 'text-muted-foreground',
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}
