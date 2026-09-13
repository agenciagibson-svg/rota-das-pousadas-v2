import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

export type PaymentStatus = 'pendente' | 'aprovado' | 'recusado' | 'estornado'

export type RecordPaymentParams = {
  bookingId: string
  providerRef: string
  amount: number
  status: PaymentStatus
  method: string
  currency: string
  updatedAt: string
  refundedAmount: number
}

export type PousadaPaymentContext = {
  pousadaId: string
  /** Cifrado — decifrar em `features/pagamentos/services` via `lib/crypto/token-cipher`. */
  accessTokenEncrypted: string
}

/**
 * Única porta de LEITURA do webhook — chama `get_pousada_payment_context`
 * (0039). O webhook não tem sessão de usuário, então não pode ler
 * `bookings`/`pousada_payment_accounts` pela RLS normal; esta RPC devolve só
 * o mínimo necessário (pousada + token cifrado) em vez de abrir leitura
 * irrestrita de tabela via service-role.
 */
export async function getPousadaPaymentContextForWebhook(bookingId: string): Promise<PousadaPaymentContext | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('get_pousada_payment_context', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as { pousadaId: string; accessTokenEncrypted: string }
  return { pousadaId: row.pousadaId, accessTokenEncrypted: row.accessTokenEncrypted }
}

/**
 * Única porta de escrita do webhook do Mercado Pago — chama a RPC
 * `reconcile_marketplace_payment` (0042) via cliente service-role, a única
 * exceção documentada em `lib/supabase/service.ts` ao uso restrito desse
 * cliente. Nunca ler/escrever tabela diretamente aqui.
 *
 * O nome da função é herdado de `record_payment_and_confirm_booking` (0039),
 * que a 0042 **revogou de todos os papéis, service_role inclusive**, por não
 * conferir moeda nem versão do evento. Não voltar a chamá-la: além de estar
 * sem permissão, ela confunde repetição de webhook com mudança legítima de
 * status. A RPC atual distingue `stale`, `already_recorded` e `ok`.
 */
export async function recordPaymentAndConfirmBookingRpc(
  p: RecordPaymentParams,
): Promise<{ status: string; paymentId?: string }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('reconcile_marketplace_payment', {
    p_booking_id: p.bookingId,
    p_provider_ref: p.providerRef,
    p_amount: p.amount,
    p_status: p.status,
    p_method: p.method,
    p_currency: p.currency,
    p_updated_at: p.updatedAt,
    p_refunded_amount: p.refundedAmount,
  })
  if (error) throw new Error(error.message)
  return data as { status: string; paymentId?: string }
}
