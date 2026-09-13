import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Friendly placeholder for empty lists, no-results and error fallbacks.
 * `size="lg"` is for screens where this IS the whole page (404, error,
 * access-denied) — default stays compact for inline use inside data lists.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  size?: 'md' | 'lg'
  className?: string
}) {
  const large = size === 'lg'
  return (
    <div
      className={cn(
        'border-border bg-card/50 flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed text-center',
        large ? 'px-8 py-20' : 'px-6 py-16',
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            'bg-secondary text-muted-foreground flex items-center justify-center rounded-2xl',
            large ? 'size-16' : 'size-12',
          )}
        >
          <Icon className={large ? 'size-8' : 'size-6'} />
        </span>
      )}
      <h3
        className={cn(
          'text-foreground font-serif font-semibold',
          large ? 'mt-1 text-3xl' : 'text-xl',
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-muted-foreground',
            large ? 'max-w-md text-lg leading-relaxed' : 'max-w-sm text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={large ? 'mt-4' : 'mt-2'}>{action}</div>}
    </div>
  )
}
