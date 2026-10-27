'use client'

import { Megaphone, Pause, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatISODate } from '@/lib/format'
import { couponConditions, couponValueLabel } from '../discount'
import type { Coupon } from '../types'

/** Esgotado ou fora do período: a bio não mostra, e o painel avisa. */
export function couponStatus(coupon: Coupon, todayISO: string): string | null {
  if (!coupon.active) return 'Pausado'
  if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) return 'Esgotado'
  if (coupon.validUntil && coupon.validUntil < todayISO) return 'Vencido'
  if (coupon.validFrom && coupon.validFrom > todayISO) return 'Ainda não começou'
  return null
}

function usesLabel(coupon: Coupon): string {
  const times = coupon.uses === 1 ? '1 vez' : `${coupon.uses} vezes`
  return coupon.maxUses !== null ? `Usado ${times} de ${coupon.maxUses}` : `Usado ${times}`
}

export function CouponCard({
  coupon,
  todayISO,
  pending,
  onToggleActive,
  onToggleFeatured,
}: {
  coupon: Coupon
  todayISO: string
  pending: boolean
  onToggleActive: () => void
  onToggleFeatured: () => void
}) {
  const status = couponStatus(coupon, todayISO)
  const conditions = couponConditions(coupon)
  if (coupon.validFrom) conditions.unshift(`Vale a partir de ${formatISODate(coupon.validFrom)}`)

  return (
    <Card
      className={cn(
        'flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between',
        status && 'opacity-70',
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground font-mono font-semibold tracking-wide">{coupon.code}</h3>
          <Badge variant="goldSoft" size="sm">
            {couponValueLabel(coupon.kind, coupon.value)} de desconto
          </Badge>
          {coupon.featured && (
            <Badge variant="primarySoft" size="sm">
              {status ? 'Escolhido para a bio (não aparece agora)' : 'Divulgado na bio'}
            </Badge>
          )}
          {status && <Badge size="sm">{status}</Badge>}
        </div>
        <p className="text-foreground text-sm">{usesLabel(coupon)}</p>
        <p className="text-muted-foreground text-sm">{conditions.join(' · ')}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {coupon.active && (
          <Button
            size="touch"
            variant={coupon.featured ? 'secondary' : 'outline'}
            aria-pressed={coupon.featured}
            disabled={pending}
            onClick={onToggleFeatured}
          >
            <Megaphone className="size-4" />
            {coupon.featured ? 'Parar de divulgar' : 'Divulgar na bio'}
          </Button>
        )}
        <Button size="touch" variant="outline" disabled={pending} onClick={onToggleActive}>
          {coupon.active ? <Pause className="size-4" /> : <Play className="size-4" />}
          {coupon.active ? 'Pausar' : 'Reativar'}
        </Button>
      </div>
    </Card>
  )
}
