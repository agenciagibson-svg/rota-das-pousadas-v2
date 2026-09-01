import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Surface primitive. Standardizes the `rounded-* border border-border
 * bg-card` blocks used for dashboard panels and pousada cards.
 */
const cardVariants = cva('bg-card', {
  variants: {
    radius: {
      '2xl': 'rounded-2xl',
      '3xl': 'rounded-3xl',
    },
    border: {
      true: 'border border-border',
      false: '',
    },
  },
  defaultVariants: {
    radius: '2xl',
    border: true,
  },
})

export function Card({
  className,
  radius,
  border,
  children,
  ...props
}: {
  className?: string
  children: ReactNode
} & VariantProps<typeof cardVariants> &
  React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(cardVariants({ radius, border }), className)} {...props}>
      {children}
    </div>
  )
}

export { cardVariants }
