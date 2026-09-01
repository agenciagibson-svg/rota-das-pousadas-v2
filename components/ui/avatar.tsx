'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const sizeMap = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' } as const

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Circular avatar with graceful initials fallback when no/failed image. */
export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string
  name: string
  size?: keyof typeof sizeMap
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const base = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary',
    sizeMap[size],
    className,
  )

  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={cn(base, 'object-cover')}
      />
    )
  }
  return (
    <span className={base} role="img" aria-label={name}>
      {initialsOf(name)}
    </span>
  )
}
