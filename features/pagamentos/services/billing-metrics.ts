/**
 * Métricas de assinatura (MRR, ativas, novas/canceladas do mês, churn) e
 * projeção simples de fluxo de caixa — cálculo puro, sem I/O, pra poder
 * testar sem banco (mesmo espírito de `pct()` em `admin-metrics.repository.ts`,
 * só que extraído pra arquivo próprio porque aqui tem lógica de verdade a
 * testar, não uma função de uma linha).
 *
 * Aproximações assumidas de propósito (não existe histórico de status por
 * dia, só `created_at`/`updated_at` de cada assinatura):
 *  - "nova este mês" = created_at cai no mês corrente e não está cancelada.
 *  - "cancelada este mês" = status atual é 'cancelled' e updated_at cai no
 *    mês corrente (verdade sempre: `sync_subscription_status` só atualiza
 *    `updated_at` quando o status muda de verdade — 0056).
 *  - churn do mês = canceladas este mês / (ativas hoje + canceladas este
 *    mês) — aproxima a base do início do mês somando de volta quem saiu.
 *  - projeção de caixa = MRR atual mantido constante pelos próximos meses
 *    (piso conservador; não modela crescimento nem cancelamento futuro).
 */

export type SubscriptionStatusValue = 'pending' | 'authorized' | 'paused' | 'cancelled'

export type SubscriptionForMetrics = {
  status: SubscriptionStatusValue
  price: number
  createdAt: string
  updatedAt: string
}

export type BillingMetrics = {
  mrr: number
  activeCount: number
  newThisMonth: number
  cancelledThisMonth: number
  churnRatePct: number | null
}

export type CashFlowMonthPoint = {
  month: string
  label: string
  projected: number
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function computeBillingMetrics(
  subscriptions: SubscriptionForMetrics[],
  now: Date = new Date(),
): BillingMetrics {
  const monthStart = startOfMonthUtc(now)

  const active = subscriptions.filter((s) => s.status === 'authorized')
  const mrr = active.reduce((sum, s) => sum + s.price, 0)

  const newThisMonth = subscriptions.filter(
    (s) => s.status !== 'cancelled' && new Date(s.createdAt) >= monthStart,
  ).length

  const cancelledThisMonth = subscriptions.filter(
    (s) => s.status === 'cancelled' && new Date(s.updatedAt) >= monthStart,
  ).length

  const churnBase = active.length + cancelledThisMonth
  const churnRatePct =
    churnBase > 0 ? Math.round((cancelledThisMonth / churnBase) * 1000) / 10 : null

  return { mrr, activeCount: active.length, newThisMonth, cancelledThisMonth, churnRatePct }
}

/** Projeção "se nada mudar": MRR atual repetido pelos próximos `months` meses. */
export function projectCashFlow(
  mrr: number,
  months: number,
  now: Date = new Date(),
): CashFlowMonthPoint[] {
  const points: CashFlowMonthPoint[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(d)
    points.push({ month: d.toISOString().slice(0, 7), label, projected: mrr })
  }
  return points
}
