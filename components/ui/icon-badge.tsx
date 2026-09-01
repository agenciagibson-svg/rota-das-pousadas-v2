import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * The soft, rounded icon container used for feature/stat tiles
 * (`flex size-N items-center justify-center rounded-xl bg-primary/10
 * text-primary`). Colors follow the brand tokens.
 */
const iconBadgeVariants = cva(
  'flex shrink-0 items-center justify-center',
  {
    variants: {
      tone: {
        primary: 'bg-primary/10 text-primary',
        ocean: 'bg-ocean/10 text-ocean',
        accent: 'bg-accent/15 text-accent',
      },
      size: {
        sm: 'size-9 rounded-lg',
        md: 'size-10 rounded-xl',
        lg: 'size-12 rounded-xl',
      },
    },
    defaultVariants: {
      tone: 'primary',
      size: 'md',
    },
  },
)

export function IconBadge({
  className,
  tone,
  size,
  children,
}: {
  className?: string
  children: ReactNode
} & VariantProps<typeof iconBadgeVariants>) {
  return (
    <span className={cn(iconBadgeVariants({ tone, size }), className)}>
      {children}
    </span>
  )
}

export { iconBadgeVariants }
