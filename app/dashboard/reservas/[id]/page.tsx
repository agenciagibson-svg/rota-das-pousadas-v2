import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { notFound } from 'next/navigation'
import { getCurrentUser, getOwnerPousada, getOwnerReservationDetail } from '@/server/queries'
import { BookingDetailView } from '@/features/reservas/components/booking-detail-view'
import { listBookingProofsForStaff } from '@/features/pagamentos/services/pix.service'
import { getBookingPaymentsForStaff } from '@/features/pagamentos/services/booking-payment.service'
import { getBookingCouponForStaff } from '@/features/cupons/services/coupons.service'
import {
  getBookingConsumption,
  listSellableItems,
} from '@/features/pedidos/services/orders.service'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldAlert } from 'lucide-react'
import { DEFAULT_TIMEZONE, isoDateInTimeZone } from '@/lib/dates'

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

  const [pousada, proofs, consumption, sellable, payments, coupon] = await Promise.all([
    getOwnerPousada(),
    listBookingProofsForStaff(booking.id).catch(() => []),
    // Conta de consumo não pode derrubar a página da reserva.
    getBookingConsumption(booking.id).catch((e) => {
      console.error('[dashboard] consumo da reserva', e)
      return null
    }),
    listSellableItems().catch(() => []),
    // Pagamentos da diária também não podem derrubar a página.
    getBookingPaymentsForStaff(booking.id).catch((e) => {
      console.error('[dashboard] pagamentos da reserva', e)
      return null
    }),
    // Cupom usado (0100) — só informativo.
    getBookingCouponForStaff(booking.id).catch((e) => {
      console.error('[dashboard] cupom da reserva', e)
      return null
    }),
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
      payments={payments}
      todayISO={isoDateInTimeZone(new Date(), pousada?.timezone ?? DEFAULT_TIMEZONE)}
      canManageBooking={booking.canManageBooking}
      coupon={coupon}
    />
  )
}
