import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { FolioCharge, FolioPayment, ManualPaymentMethod } from '@/features/reservas/folio'

/** A reserva é da pousada informada? A conta nunca é lida só pelo id da URL. */
export async function isBookingOfPousada(bookingId: string, pousadaId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

/** Consumo lançado na reserva, do mais antigo ao mais recente (cancelados inclusive — nada some da conta). */
export async function listBookingCharges(bookingId: string): Promise<FolioCharge[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('booking_charges')
    .select(
      'id, description, quantity, unit_price, amount, created_at, cancelled_at, cancellation_reason',
    )
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    description: c.description,
    quantity: c.quantity,
    unitPrice: Number(c.unit_price),
    amount: Number(c.amount),
    createdAt: c.created_at,
    cancelledAt: c.cancelled_at,
    cancellationReason: c.cancellation_reason,
  }))
}

/** Pagamentos da reserva — Mercado Pago e balcão —, do mais antigo ao mais recente. */
export async function listBookingPayments(bookingId: string): Promise<FolioPayment[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, source, method, amount, status, created_at, notes, reversed_at, reversal_reason')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    source: p.source === 'manual' ? 'manual' : 'mercadopago',
    method: p.method,
    amount: Number(p.amount),
    status: p.status,
    createdAt: p.created_at,
    notes: p.notes,
    reversedAt: p.reversed_at,
    reversalReason: p.reversal_reason,
  }))
}

export async function addBookingChargeRpc(input: {
  bookingId: string
  description: string
  quantity: number
  unitPrice: number
}): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('add_booking_charge', {
    p_booking_id: input.bookingId,
    p_description: input.description,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
  })
  if (error) throw new Error(error.message)
}

export async function cancelBookingChargeRpc(chargeId: string, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('cancel_booking_charge', {
    p_charge_id: chargeId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}

/** `confirmed`: o pagamento quitou uma reserva pendente e o banco a confirmou. */
export async function registerManualPaymentRpc(input: {
  bookingId: string
  method: ManualPaymentMethod
  amount: number
  notes: string
}): Promise<{ confirmed: boolean }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('register_manual_payment', {
    p_booking_id: input.bookingId,
    p_method: input.method,
    p_amount: input.amount,
    p_notes: input.notes,
  })
  if (error) throw new Error(error.message)
  const result = data as { confirmed?: boolean } | null
  return { confirmed: result?.confirmed === true }
}

export async function reverseManualPaymentRpc(paymentId: string, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('reverse_manual_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}
