import { notFound } from 'next/navigation'
import {
  getCurrentUser,
  getOwnerBookingFolio,
  getOwnerPousada,
  getOwnerReservationDetail,
} from '@/server/queries'
import { DEFAULT_TIMEZONE, isValidTimeZone } from '@/lib/dates'
import { BookingDetailView } from '@/features/reservas/components/booking-detail-view'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldAlert } from 'lucide-react'

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  let booking
  try {
    booking = await getOwnerReservationDetail(id)
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon={ShieldAlert}
          title="Sem permissão"
          description="Você não tem acesso a reservas desta pousada."
        />
      </div>
    )
  }
  if (!booking) notFound()

  const [pousada, folio] = await Promise.all([getOwnerPousada(), getOwnerBookingFolio(id)])
  const displayName = user?.name || user?.email || 'Proprietário'
  // Fuso gravado antes da validação das Configurações pode ser texto livre.
  const timeZone =
    pousada && isValidTimeZone(pousada.timezone) ? pousada.timezone : DEFAULT_TIMEZONE
  return (
    <BookingDetailView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      timeZone={timeZone}
      booking={booking}
      folio={folio}
    />
  )
}
