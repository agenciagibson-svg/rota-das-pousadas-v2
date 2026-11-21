import { Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatISODate } from '@/lib/format'
import type { ActiveOffer } from '@/repositories/offers.repository'

/** Faixa da oferta recebida (0111) na página da pousada: o cupom já vai na reserva. */
export function OfferPerk({ offer, className }: { offer: ActiveOffer; className?: string }) {
  const period =
    offer.stayFrom && offer.stayUntil
      ? `Estadias de ${formatISODate(offer.stayFrom)} a ${formatISODate(offer.stayUntil)}`
      : null
  return (
    <aside
      aria-label="Sua oferta"
      className={cn('border-ipe/50 bg-ipe/15 flex gap-3 rounded-2xl border p-4', className)}
    >
      <Gift className="text-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="text-foreground">
          <strong>Oferta para você:</strong> {offer.percent}% de desconto com o cupom{' '}
          <strong className="font-mono tracking-wide">{offer.code}</strong>, já aplicado na reserva.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {[`Válido até ${formatISODate(offer.validUntil)}`, period, 'Só para você, uso único']
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </aside>
  )
}
