import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** Pagamento da diária visto pela equipe (detalhe da reserva). */
export type BookingPaymentRow = {
  id: string
  amount: number
  /** `manual_dinheiro`, `pix_direto`, método do Mercado Pago… */
  method: string
  status: 'pendente' | 'aprovado' | 'recusado' | 'estornado'
  /** Lançado pela equipe no painel (só esses podem ser estornados aqui). */
  manual: boolean
  createdAt: string
}

/** A RLS de `payments` (0085) só devolve pagamentos de reservas da pousada da equipe. */
export async function listBookingPayments(bookingId: string): Promise<BookingPaymentRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, method, status, provider_ref, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    status: p.status as BookingPaymentRow['status'],
    manual: (p.provider_ref ?? '').startsWith('manual:'),
    createdAt: p.created_at,
  }))
}

export type RegisterBookingPaymentResult = {
  bookingId: string
  amount: number
  remaining: number
  confirmed: boolean
}

export async function registerBookingPaymentRpc(input: {
  bookingId: string
  amount: number
  method: string
  note: string
}): Promise<RegisterBookingPaymentResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('register_booking_payment', {
    p_booking_id: input.bookingId,
    p_amount: input.amount,
    p_method: input.method,
    p_note: input.note,
  })
  if (error) throw new Error(error.message)
  const r = data as {
    bookingId: string
    amount: number | string
    remaining: number | string
    confirmed: boolean
  }
  return {
    bookingId: r.bookingId,
    amount: Number(r.amount),
    remaining: Number(r.remaining),
    confirmed: r.confirmed,
  }
}

export async function reverseBookingPaymentRpc(
  paymentId: string,
  reason: string,
): Promise<{ bookingId: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('reverse_booking_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  return { bookingId: (data as { bookingId: string }).bookingId }
}
