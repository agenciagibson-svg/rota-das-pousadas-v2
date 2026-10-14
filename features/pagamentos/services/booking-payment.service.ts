import 'server-only'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { getBookingPousadaId } from '@/repositories/bookings.repository'
import {
  listBookingPayments,
  registerBookingPaymentRpc,
  reverseBookingPaymentRpc,
  type BookingPaymentRow,
} from '@/repositories/booking-payments.repository'
import { requireCapability } from './access'
import { notifyBookingConfirmed } from './webhook.service'
import type { ManualPaymentMethod } from '../booking-payment'

export type BookingPayments = {
  payments: BookingPaymentRow[]
  /** Recepção, gestor, financeiro e proprietário registram o que receberam. */
  canRegister: boolean
  /** Só proprietário, gestor e financeiro estornam (mesma regra do consumo). */
  canReverse: boolean
}

async function requireBookingInPousada(bookingId: string, pousadaId: string) {
  if ((await getBookingPousadaId(bookingId)) !== pousadaId) {
    throw new Error('Reserva não encontrada nesta pousada.')
  }
}

/** Pagamentos da diária para o detalhe da reserva — `null` para quem não vê valores. */
export async function getBookingPaymentsForStaff(
  bookingId: string,
): Promise<BookingPayments | null> {
  const pousadaId = await getActivePousadaId()
  const role = await getActiveTenantRole()
  if (!pousadaId || !role || !can(role, 'payment:register')) return null
  return {
    payments: await listBookingPayments(bookingId),
    canRegister: can(role, 'payment:register'),
    canReverse: can(role, 'payment:refund'),
  }
}

/**
 * Valor da diária recebido no balcão (dinheiro, cartão, Pix na chave da
 * recepção, transferência). Se a reserva estava pendente e o saldo zerou, o
 * banco a confirma e o hóspede recebe o e-mail de confirmação.
 */
export async function registerBookingPayment(input: {
  bookingId: string
  amount: number
  method: ManualPaymentMethod
  note: string
}): Promise<{ bookingId: string; confirmed: boolean }> {
  const { pousadaId } = await requireCapability('payment:register')
  await requireBookingInPousada(input.bookingId, pousadaId)
  const result = await registerBookingPaymentRpc(input)
  if (result.confirmed) {
    try {
      await notifyBookingConfirmed(result.bookingId)
    } catch (error) {
      console.error('[pagamento manual] falha ao avisar o hóspede', {
        bookingId: result.bookingId,
        error: String(error),
      })
    }
  }
  return { bookingId: result.bookingId, confirmed: result.confirmed }
}

/** Estorno de um lançamento manual feito errado — fica registrado com o motivo. */
export async function reverseBookingPayment(input: {
  bookingId: string
  paymentId: string
  reason: string
}): Promise<{ bookingId: string }> {
  const { pousadaId } = await requireCapability('payment:refund')
  await requireBookingInPousada(input.bookingId, pousadaId)
  return reverseBookingPaymentRpc(input.paymentId, input.reason)
}
