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
    p_next_billing_date: params.nextBillingDate ?? undefined,
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
    p_period_start: params.periodStart ?? undefined,
    p_period_end: params.periodEnd ?? undefined,
    p_paid_at: params.paidAt ?? undefined,
  })
  if (error) throw new Error(error.message)
  return data as { status: string; invoiceId?: string }
}

// -----------------------------------------------------------------------
// Contas a receber / MRR / churn / faturas — tela "Financeiro" do painel
// master (achado da avaliação de 19/09/2026, item que ficava bloqueado até
// o motor de cobrança existir). Junta em JS em vez de usar embed do
// PostgREST (`plans(price)`) — mesmo padrão de `getPousadaPerformance` em
// `admin-metrics.repository.ts`, evita depender da tipagem de relação
// aninhada do `database.types.ts` pra uma consulta que roda raramente.
// -----------------------------------------------------------------------

export type SubscriptionForMetricsRow = {
  status: SubscriptionStatus
  price: number
  createdAt: string
  updatedAt: string
}

/** Dado bruto pra `computeBillingMetrics` (features/pagamentos/services/billing-metrics.ts). */
export async function listSubscriptionsForMetrics(): Promise<SubscriptionForMetricsRow[]> {
  const supabase = await createSupabaseServerClient()
  const [{ data: subs, error: subsError }, { data: plans, error: plansError }] = await Promise.all([
    supabase.from('subscriptions').select('plan_id, status, created_at, updated_at'),
    supabase.from('plans').select('id, price'),
  ])
  if (subsError) throw subsError
  if (plansError) throw plansError

  const priceByPlan = new Map((plans ?? []).map((p) => [p.id, Number(p.price)]))
  return (subs ?? []).map((s) => ({
    status: s.status as SubscriptionStatus,
    price: priceByPlan.get(s.plan_id) ?? 0,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }))
}

export type ReceivableSubscriptionRow = {
  pousadaId: string
  pousadaName: string
  planName: string
  amount: number
  status: SubscriptionStatus
  nextBillingDate: string | null
}

/** "Contas a receber": toda assinatura não cancelada, ordenada pela próxima cobrança. */
export async function listReceivableSubscriptions(): Promise<ReceivableSubscriptionRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('pousada_id, plan_id, status, next_billing_date')
    .neq('status', 'cancelled')
    .order('next_billing_date', { ascending: true, nullsFirst: false })
  if (subsError) throw subsError
  if (!subs || subs.length === 0) return []

  const pousadaIds = [...new Set(subs.map((s) => s.pousada_id))]
  const planIds = [...new Set(subs.map((s) => s.plan_id))]
  const [{ data: pousadas, error: pousadasError }, { data: plans, error: plansError }] =
    await Promise.all([
      supabase.from('pousadas').select('id, name').in('id', pousadaIds),
      supabase.from('plans').select('id, name, price').in('id', planIds),
    ])
  if (pousadasError) throw pousadasError
  if (plansError) throw plansError

  const nameByPousada = new Map((pousadas ?? []).map((p) => [p.id, p.name]))
  const planById = new Map(
    (plans ?? []).map((p) => [p.id, { name: p.name, price: Number(p.price) }]),
  )

  return subs.map((s) => ({
    pousadaId: s.pousada_id,
    pousadaName: nameByPousada.get(s.pousada_id) ?? '—',
    planName: planById.get(s.plan_id)?.name ?? '—',
    amount: planById.get(s.plan_id)?.price ?? 0,
    status: s.status as SubscriptionStatus,
    nextBillingDate: s.next_billing_date,
  }))
}

export type InvoiceRow = {
  id: string
  pousadaName: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'
  periodStart: string | null
  periodEnd: string | null
  paidAt: string | null
}

/** Últimas faturas de assinatura (qualquer status), pra tela de Financeiro do master. */
export async function listRecentInvoices(limit = 30): Promise<InvoiceRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, subscription_id, amount, status, period_start, period_end, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (invoicesError) throw invoicesError
  if (!invoices || invoices.length === 0) return []

  const subscriptionIds = [...new Set(invoices.map((i) => i.subscription_id))]
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('id, pousada_id')
    .in('id', subscriptionIds)
  if (subsError) throw subsError

  const pousadaIdBySubscription = new Map((subs ?? []).map((s) => [s.id, s.pousada_id]))
  const pousadaIds = [...new Set((subs ?? []).map((s) => s.pousada_id))]
  const { data: pousadas, error: pousadasError } = await supabase
    .from('pousadas')
    .select('id, name')
    .in('id', pousadaIds)
  if (pousadasError) throw pousadasError
  const nameByPousada = new Map((pousadas ?? []).map((p) => [p.id, p.name]))

  return invoices.map((i) => {
    const pousadaId = pousadaIdBySubscription.get(i.subscription_id)
    return {
      id: i.id,
      pousadaName: (pousadaId && nameByPousada.get(pousadaId)) ?? '—',
      amount: Number(i.amount),
      status: i.status as InvoiceRow['status'],
      periodStart: i.period_start,
      periodEnd: i.period_end,
      paidAt: i.paid_at,
    }
  })
}
