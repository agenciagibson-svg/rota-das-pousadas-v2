import 'server-only'
import { requireCapability } from '@/features/acomodacoes/services/access'
import { notifyBookingConfirmed } from '@/features/pagamentos/services/booking-confirmed-email'
import { can } from '@/lib/auth/rbac'
import {
  addBookingChargeRpc,
  cancelBookingChargeRpc,
  isBookingOfPousada,
  listBookingCharges,
  listBookingPayments,
  registerManualPaymentRpc,
  reverseManualPaymentRpc,
} from '@/repositories/folio.repository'
import type { BookingFolio } from '../folio'
import type {
  AddChargeInput,
  CancelChargeInput,
  RegisterPaymentInput,
  ReversePaymentInput,
} from '../folio-schemas'

/**
 * Conta do hóspede de uma reserva da pousada ativa. Mesma barreira da página
 * da reserva (`booking:manage`); os botões dependem de `payment:register`
 * (lançar) e `payment:refund` (desfazer). As RPCs da 0069 e a RLS de
 * `booking_charges`/`payments` repetem a regra no banco.
 */
export async function getBookingFolio(bookingId: string): Promise<BookingFolio | null> {
  const { pousadaId, role } = await requireCapability('booking:manage')
  if (!(await isBookingOfPousada(bookingId, pousadaId))) return null
  const [charges, payments] = await Promise.all([
    listBookingCharges(bookingId),
    listBookingPayments(bookingId),
  ])
  return {
    charges,
    payments,
    canRegister: can(role, 'payment:register'),
    canReverse: can(role, 'payment:refund'),
  }
}

export async function addCharge(input: AddChargeInput): Promise<void> {
  await requireCapability('payment:register')
  await addBookingChargeRpc(input)
}

export async function cancelCharge(input: CancelChargeInput): Promise<void> {
  await requireCapability('payment:refund')
  await cancelBookingChargeRpc(input.chargeId, input.reason)
}

/**
 * Pagamento que quita uma reserva pendente a confirma no banco; aí o hóspede
 * recebe o e-mail de confirmação, como no pagamento pelo Mercado Pago.
 */
export async function registerPayment(
  input: RegisterPaymentInput,
): Promise<{ confirmed: boolean }> {
  await requireCapability('payment:register')
  const result = await registerManualPaymentRpc({
    bookingId: input.bookingId,
    method: input.method,
    amount: input.amount,
    notes: input.notes ?? '',
  })
  if (result.confirmed) await notifyBookingConfirmed(input.bookingId)
  return result
}

export async function reversePayment(input: ReversePaymentInput): Promise<void> {
  await requireCapability('payment:refund')
  await reverseManualPaymentRpc(input.paymentId, input.reason)
}
