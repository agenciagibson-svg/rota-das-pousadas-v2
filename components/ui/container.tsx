import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Canonical page gutter used across the whole site:
 * `mx-auto max-w-7xl px-5 lg:px-8`.
 * Replaces the string repeated in every landing/section component.
 */
export function Container({
  as: Tag = 'div',
  className,
  children,
  ...props
}: {
  as?: 'div' | 'section' | 'header' | 'footer'
  className?: string
  children: ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn('mx-auto max-w-7xl px-5 lg:px-8', className)} {...props}>
      {children}
    </Tag>
  )
}

/**
 * A full-width `<section>` whose inner content is constrained by the
 * standard container. Pass vertical rhythm via `className`
 * (e.g. "py-20 lg:py-28").
 */
export function Section({
  className,
  children,
  ...props
}: {
  className?: string
  children: ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('mx-auto max-w-7xl px-5 lg:px-8', className)}
      {...props}
    >
      {children}
    </section>
  )
}
