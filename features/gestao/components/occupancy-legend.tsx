import { BedDouble, Clock, Link2, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BOOKING_STATUS } from '@/features/reservas'
import type { BookingStatus } from '@/features/reservas/types'

const SHOWN: { status: BookingStatus; icon?: typeof Clock }[] = [
  { status: 'pending', icon: Clock },
  { status: 'confirmed' },
  { status: 'checked_in', icon: BedDouble },
  { status: 'checked_out' },
]

/** Legenda do mapa: cores dos status (as mesmas da lista) e as faixas fixas. */
export function OccupancyLegend() {
  return (
    <div className="text-muted-foreground mt-4 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {SHOWN.map(({ status, icon: Icon }) => (
          <Badge key={status} variant={BOOKING_STATUS[status].variant} size="sm">
            {Icon && <Icon className="size-3" aria-hidden />}
            {BOOKING_STATUS[status].label}
          </Badge>
        ))}
        <Badge
          variant="outline"
          size="sm"
          className="border-destructive/40 bg-destructive/5 text-destructive border-dashed"
        >
          <Lock className="size-3" aria-hidden /> Bloqueio
        </Badge>
        <Badge variant="outline" size="sm" className="bg-muted text-muted-foreground border-dashed">
          <Link2 className="size-3" aria-hidden /> Vendido no Airbnb/Booking (calendário
          sincronizado)
        </Badge>
      </div>
      <p>
        No computador: arraste a reserva para outro quarto ou outras datas, ou puxe a borda direita
        para mudar a saída. No celular: toque na reserva e use “Mover”. Reservas do Airbnb, Booking
        e Expedia mudam primeiro no canal.
      </p>
    </div>
  )
}
