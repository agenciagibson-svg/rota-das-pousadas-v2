'use client'

import { CalendarClock, Download, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { BarChart } from '@/components/dashboard/charts'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import type {
  BillingMetrics,
  CashFlowMonthPoint,
  ReceivableSubscription,
  InvoiceRecord,
  SubscriptionStatusValue,
  InvoiceStatusValue,
} from '../types'

/** Valor de assinatura tem centavos (R$59,90) — mesmo formatador de `platform-finance.tsx`. */
function formatPlanPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`))
}

const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatusValue, string> = {
  pending: 'aguardando autorização',
  authorized: 'ativa',
  paused: 'pausada',
  cancelled: 'cancelada',
}

const SUBSCRIPTION_STATUS_VARIANT: Record<
  SubscriptionStatusValue,
  'primarySoft' | 'goldSoft' | 'secondary' | 'destructiveSoft'
> = {
  pending: 'goldSoft',
  authorized: 'primarySoft',
  paused: 'secondary',
  cancelled: 'destructiveSoft',
}

const INVOICE_STATUS_LABEL: Record<InvoiceStatusValue, string> = {
  pending: 'pendente',
  approved: 'paga',
  rejected: 'rejeitada',
  refunded: 'estornada',
  cancelled: 'cancelada',
}

const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatusValue,
  'primarySoft' | 'goldSoft' | 'secondary' | 'destructiveSoft'
> = {
  pending: 'goldSoft',
  approved: 'primarySoft',
  rejected: 'destructiveSoft',
  refunded: 'secondary',
  cancelled: 'secondary',
}

/** Gera e baixa um CSV no navegador (mesma função de `reports-view.tsx` — sem um lib/ compartilhado pra isso ainda). */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n')
  // BOM (﻿) pro Excel em pt-BR reconhecer UTF-8 e não corromper acentos.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Contas a receber, MRR/churn e projeção de caixa das assinaturas — segunda
 * peça do Financeiro do painel master, agora que o motor de cobrança (0056)
 * existe (a primeira peça foi as contas a pagar, em `platform-finance.tsx`).
 * A projeção de caixa é deliberadamente simples (MRR atual mantido constante
 * pelos próximos meses, ver `billing-metrics.ts`) — não é previsão de
 * crescimento, é o piso conservador "se nada mudar".
 */
export function BillingOverview({
  metrics,
  cashFlow,
  receivables,
  recentInvoices,
}: {
  metrics: BillingMetrics
  cashFlow: CashFlowMonthPoint[]
  receivables: ReceivableSubscription[]
  recentInvoices: InvoiceRecord[]
}) {
  const kpiCards = [
    {
      label: 'MRR (receita recorrente mensal)',
      value: formatPlanPrice(metrics.mrr),
      icon: TrendingUp,
    },
    { label: 'Assinaturas ativas', value: String(metrics.activeCount), icon: Users },
    { label: 'Novas este mês', value: String(metrics.newThisMonth), icon: CalendarClock },
    {
      label: 'Churn do mês',
      value: metrics.churnRatePct === null ? '—' : `${metrics.churnRatePct.toFixed(1)}%`,
      icon: TrendingDown,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-5">
            <IconBadge tone="ocean" size="md">
              <k.icon className="size-5" />
            </IconBadge>
            <div className="text-foreground mt-4 text-2xl font-semibold">{k.value}</div>
            <div className="text-muted-foreground text-sm">{k.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-foreground font-display text-lg font-medium">
            Projeção de fluxo de caixa
          </h3>
          <p className="text-muted-foreground text-sm">
            Próximos {cashFlow.length} meses · assume o MRR atual constante (piso conservador, sem
            crescimento nem cancelamento futuro projetado)
          </p>
        </div>
        <div className="h-36">
          <BarChart
            data={cashFlow.map((c) => c.projected)}
            labels={cashFlow.map((c) => c.label)}
            color="var(--ocean)"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-foreground font-display text-lg font-medium">Contas a receber</h3>
            <p className="text-muted-foreground text-sm">
              {receivables.length} assinatura(s) não cancelada(s)
            </p>
          </div>
          {receivables.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'contas-a-receber-assinaturas.csv',
                  ['Pousada', 'Plano', 'Valor (R$)', 'Status', 'Próxima cobrança'],
                  receivables.map((r) => [
                    r.pousadaName,
                    r.planName,
                    r.amount,
                    SUBSCRIPTION_STATUS_LABEL[r.status],
                    r.nextBillingDate ?? '',
                  ]),
                )
              }
              className="border-border text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Download className="size-3.5" />
              Exportar CSV
            </button>
          )}
        </div>
        {receivables.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma assinatura ativa ou pendente ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {receivables.map((r) => (
              <div
                key={r.pousadaId}
                className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate font-medium">{r.pousadaName}</span>
                    <Badge
                      variant={SUBSCRIPTION_STATUS_VARIANT[r.status]}
                      size="md"
                      className="px-2 py-0.5 font-semibold"
                    >
                      {SUBSCRIPTION_STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {r.planName} · {formatPlanPrice(r.amount)} · próxima cobrança{' '}
                    {fmtDate(r.nextBillingDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-foreground font-display text-lg font-medium">Faturas recentes</h3>
          <p className="text-muted-foreground text-sm">
            Últimas {recentInvoices.length} cobrança(s)
          </p>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma fatura registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate font-medium">{inv.pousadaName}</span>
                    <Badge
                      variant={INVOICE_STATUS_VARIANT[inv.status]}
                      size="md"
                      className="px-2 py-0.5 font-semibold"
                    >
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatPlanPrice(inv.amount)}
                    {inv.periodStart && inv.periodEnd
                      ? ` · período ${fmtDate(inv.periodStart)}–${fmtDate(inv.periodEnd)}`
                      : ''}
                    {inv.paidAt ? ` · pago em ${fmtDate(inv.paidAt)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
