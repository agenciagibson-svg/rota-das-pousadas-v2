import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact page numbers with ellipsis around the current page. */
function pageRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('ellipsis')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null
  const btn =
    'inline-flex size-9 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav aria-label="Paginação" className={cn('flex items-center justify-center gap-1.5', className)}>
      <button className={btn} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
        <ChevronLeft className="size-4" />
      </button>
      {pageRange(page, totalPages).map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page && 'border-primary bg-primary text-primary-foreground hover:bg-primary')}
          >
            {p}
          </button>
        ),
      )}
      <button className={btn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
