import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Pill / tag / status chip. Consolidates the many inline
 * `rounded-full ... px-3 py-1 text-xs` variants scattered across the app
 * (tag chips, status labels, "3 novas", rating badges, etc.).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        secondary: 'bg-secondary text-secondary-foreground',
        primarySoft: 'bg-primary/10 text-primary',
        accentSoft: 'bg-accent/15 text-accent',
        goldSoft: 'bg-gold/15 text-foreground',
        destructiveSoft: 'bg-destructive/10 text-destructive',
        glass: 'glass text-foreground',
        outline: 'border border-border text-foreground',
      },
      size: {
        sm: 'px-2.5 py-1 text-[11px]',
        md: 'px-3 py-1 text-xs',
        lg: 'px-3.5 py-1.5 text-xs font-semibold',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export function Badge({
  className,
  variant,
  size,
  children,
}: {
  className?: string
  children: ReactNode
} & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {children}
    </span>
  )
}

export { badgeVariants }
