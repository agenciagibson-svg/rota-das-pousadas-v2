import { cn } from '@/lib/utils'

/** Pulsing placeholder for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />
}
