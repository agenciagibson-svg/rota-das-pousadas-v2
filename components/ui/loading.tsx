import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizeMap = { sm: 'size-4', md: 'size-6', lg: 'size-8' } as const

/** Accessible spinner with optional label. */
export function Loading({
  label = 'Carregando…',
  size = 'md',
  className,
}: {
  label?: string
  size?: keyof typeof sizeMap
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 text-muted-foreground', className)}
    >
      <Loader2 className={cn('animate-spin text-primary', sizeMap[size])} />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  )
}
