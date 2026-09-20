import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

export type ActivePlan = {
  id: string
  name: string
  price: number
  mpPreapprovalPlanId: string | null
}

export type SubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled'

export type SubscriptionRow = {
  id: string
  pousadaId: string
  planId: string
  mpPreapprovalId: string | null
  status: SubscriptionStatus
  nextBillingDate: string | null
}

/** Único plano ativo hoje (decisão de 19/09/2026: plano único pra toda pousada). */
export async function getActivePlan(): Promise<ActivePlan | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, price, mp_preapproval_plan_id')
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    price: Number(data.price),
    mpPreapprovalPlanId: data.mp_preapproval_plan_id,
  }
}

/** Grava o `mp_preapproval_plan_id` depois de criado na API do Mercado Pago (operação única, feita pelo master). */
export async function setPlanPreapprovalId(
  planId: string,
  mpPreapprovalPlanId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('plans')
    .update({ mp_preapproval_plan_id: mpPreapprovalPlanId })
    .eq('id', planId)
  if (error) throw error
}

export async function getSubscriptionByPousada(pousadaId: string): Promise<SubscriptionRow | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, pousada_id, plan_id, mp_preapproval_id, status, next_billing_date')
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    pousadaId: data.pousada_id,
    planId: data.plan_id,
    mpPreapprovalId: data.mp_preapproval_id,
    status: data.status as SubscriptionStatus,
    nextBillingDate: data.next_billing_date,
  }
}

/** Chamada depois de criar o preapproval na API do Mercado Pago — grava como 'pending' até o webhook confirmar. */
export async function createPendingSubscriptionRpc(params: {
  pousadaId: string
  planId: string
  mpPreapprovalId: string
}): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_pending_subscription', {
    p_pousada_id: params.pousadaId,
    p_plan_id: params.planId,
    p_mp_preapproval_id: params.mpPreapprovalId,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/**
 * Únicas portas de escrita do webhook de assinatura (sem sessão de usuário —
 * mesmo padrão de `payments.repository.ts` pro webhook de pagamento de
 * hóspede: `createSupabaseServiceRoleClient` só pra chamar a RPC, nunca ler/
 * escrever tabela direto).
 */
export async function syncSubscriptionStatusRpc(params: {
  mpPreapprovalId: string
  status: SubscriptionStatus
  nextBillingDate: string | null
}): Promise<{ status: string; subscriptionId?: string }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('sync_subscription_status', {
    p_mp_preapproval_id: params.mpPreapprovalId,
    p_status: params.status,
    p_next_billing_date: params.nextBillingDate,
  })
  if (error) throw new Error(error.message)
  return data as { status: string; subscriptionId?: string }
}

export async function recordSubscriptionInvoiceRpc(params: {
  mpPreapprovalId: string
  mpPaymentId: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'
  periodStart: string | null
  periodEnd: string | null
  paidAt: string | null
}): Promise<{ status: string; invoiceId?: string }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('record_subscription_invoice', {
    p_mp_preapproval_id: params.mpPreapprovalId,
    p_mp_payment_id: params.mpPaymentId,
    p_amount: params.amount,
    p_status: params.status,
    p_period_start: params.periodStart,
    p_period_end: params.periodEnd,
    p_paid_at: params.paidAt,
  })
  if (error) throw new Error(error.message)
  return data as { status: string; invoiceId?: string }
}
