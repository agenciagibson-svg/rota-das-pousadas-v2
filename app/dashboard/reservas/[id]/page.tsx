import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { notFound } from 'next/navigation'
import { getCurrentUser, getOwnerPousada, getOwnerReservationDetail } from '@/server/queries'
import { BookingDetailView } from '@/features/reservas/components/booking-detail-view'
import { listBookingProofsForStaff } from '@/features/pagamentos/services/pix.service'
import {
  getBookingConsumption,
  listSellableItems,
} from '@/features/pedidos/services/orders.service'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldAlert } from 'lucide-react'

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (await sectionDenied('reservas')) return <NoSectionAccess section="reservas" title="Reserva" />

  const { id } = await params
  const user = await getCurrentUser()

  let booking
  try {
    booking = await getOwnerReservationDetail(id)
  } catch (error) {
    console.error('[dashboard] falha ao carregar reserva', error)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon={ShieldAlert}
          title="Não foi possível abrir esta reserva"
          description="Tente de novo em instantes. Se continuar, confira se a reserva é desta pousada."
        />
      </div>
    )
  }
  if (!booking) notFound()

  const [pousada, proofs, consumption, sellable] = await Promise.all([
    getOwnerPousada(),
    listBookingProofsForStaff(booking.id).catch(() => []),
    // Conta de consumo não pode derrubar a página da reserva.
    getBookingConsumption(booking.id).catch((e) => {
      console.error('[dashboard] consumo da reserva', e)
      return null
    }),
    listSellableItems().catch(() => []),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'
  return (
    <BookingDetailView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      booking={booking}
      proofs={proofs}
      consumption={consumption}
      sellable={sellable}
    />
  )
}
