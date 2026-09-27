import type { BookingStatus } from '@/features/reservas'

/** Status que o Mercado Pago acrescenta na URL de volta (`status` / `collection_status`). */
export type MpReturnStatus = 'approved' | 'pending' | 'in_process' | 'rejected' | 'failure' | null

export function parseMpReturnStatus(value: string | undefined): MpReturnStatus {
  switch (value) {
    case 'approved':
    case 'pending':
    case 'in_process':
    case 'rejected':
    case 'failure':
      return value
    default:
      return null
  }
}

export type PaymentReturnVariant = 'confirmed' | 'confirming' | 'analysis' | 'failed'

export function paymentReturnVariant(
  booking: { status: BookingStatus },
  mpStatus: MpReturnStatus,
): PaymentReturnVariant {
  if (['confirmed', 'checked_in', 'checked_out'].includes(booking.status)) return 'confirmed'
  if (mpStatus === 'approved') return 'confirming'
  if (mpStatus === 'pending' || mpStatus === 'in_process') return 'analysis'
  return 'failed'
}
