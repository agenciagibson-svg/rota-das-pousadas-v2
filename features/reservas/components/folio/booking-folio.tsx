import { Card } from '@/components/ui/card'
import { acceptsCharges, acceptsPayments, formatBRL, type BookingFolio } from '../../folio'
import type { BookingStatus } from '../../types'
import { FolioCharges } from './folio-charges'
import { FolioPayments } from './folio-payments'

/**
 * Conta do hóspede (0069): consumo lançado por pedido e pagamentos. O saldo
 * vem do banco (`balance_due` = total da estadia + consumo − recebido).
 */
export function BookingFolioCard({
  bookingId,
  status,
  balanceDue,
  timeZone,
  folio,
}: {
  bookingId: string
  status: BookingStatus
  balanceDue: number
  timeZone: string
  folio: BookingFolio
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-foreground font-semibold">Conta do hóspede</h2>
          <p className="text-muted-foreground text-sm">
            Lance o consumo a cada pedido e registre, no fechamento, como o hóspede pagou.
          </p>
        </div>
        <p className="text-foreground text-sm font-semibold">
          {balanceDue > 0 ? `Saldo em aberto: ${formatBRL(balanceDue)}` : 'Conta quitada'}
        </p>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <FolioCharges
          bookingId={bookingId}
          charges={folio.charges}
          timeZone={timeZone}
          canRegister={folio.canRegister}
          canReverse={folio.canReverse}
          acceptsCharges={acceptsCharges(status)}
        />
        <FolioPayments
          bookingId={bookingId}
          payments={folio.payments}
          balanceDue={balanceDue}
          timeZone={timeZone}
          canRegister={folio.canRegister}
          canReverse={folio.canReverse}
          acceptsPayments={acceptsPayments(status)}
        />
      </div>
    </Card>
  )
}
