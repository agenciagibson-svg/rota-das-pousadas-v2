import { TicketPercent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { couponConditions, couponValueLabel } from '../discount'
import type { FeaturedCoupon } from '../types'

/**
 * Faixa "reservando direto aqui" (0100) na bio e na página da pousada. Só
 * HTML (a bio funciona sem JavaScript). O texto sai dos dados do cupom
 * divulgado — nada de "melhor preço garantido", que a Rota não consegue provar.
 * Sem cupom divulgado valendo hoje, quem chama não renderiza nada.
 */
export function DirectBookingPerk({
  coupon,
  className,
}: {
  coupon: FeaturedCoupon
  className?: string
}) {
  const conditions = couponConditions(coupon)
  return (
    <aside
      aria-label="Vantagem de reservar direto"
      className={cn('border-ipe/50 bg-ipe/15 flex gap-3 rounded-2xl border p-4', className)}
    >
      <TicketPercent className="text-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="text-foreground">
          <strong>Reservando direto aqui:</strong> use o cupom{' '}
          <strong className="font-mono tracking-wide">{coupon.code}</strong> e ganhe{' '}
          <strong>{couponValueLabel(coupon.kind, coupon.value)}</strong> de desconto.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{conditions.join(' · ')}</p>
      </div>
    </aside>
  )
}
