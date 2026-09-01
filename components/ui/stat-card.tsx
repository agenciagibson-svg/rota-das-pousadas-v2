import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * KPI / metric card shared by the owner dashboard and admin panel.
 * Extracts the duplicated stat block (icon + delta chip + value + label).
 */
export function StatCard({
  label,
  value,
  delta,
  up = true,
  icon: Icon,
  tone = 'primary',
  className,
}: {
  label: string
  value: string
  delta?: string
  up?: boolean
  icon: LucideIcon
  tone?: 'primary' | 'ocean'
  className?: string
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between">
        <IconBadge tone={tone} size="md">
          <Icon className="size-5" />
        </IconBadge>
        {delta && (
          <Badge
            variant={up ? 'primarySoft' : 'destructiveSoft'}
            size="md"
            className="gap-1 px-2 py-1 font-semibold"
          >
            {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {delta}
          </Badge>
        )}
      </div>
      <div className="mt-4 text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  )
}
