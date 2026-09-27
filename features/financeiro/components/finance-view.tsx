'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wallet, TrendingUp, Clock, ArrowDownCircle, Scale, Check, RotateCcw } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BOOKING_STATUS } from '@/features/reservas/status'
import type { BookingStatus } from '@/features/reservas/types'
import { setExpensePaidAction } from '../actions'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { ExpenseForm } from './expense-form'
import type { FinanceSummary, Transaction } from '../types'

function brl(n: number): string {
  return 'R$ ' + n.toLocaleString('pt-BR')
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function statusBadge(t: Transaction) {
  if (t.kind === 'despesa') {
    return t.status === 'pago'
      ? { label: 'Paga', variant: 'primarySoft' as const }
      : { label: 'A pagar', variant: 'goldSoft' as const }
  }
  // Pagamento da conta de consumo (0078).
  if (t.status === 'pago') return { label: 'Consumo pago', variant: 'primarySoft' as const }
  const s = BOOKING_STATUS[t.status as BookingStatus]
  return s ?? { label: t.status, variant: 'secondary' as const }
}

export function FinanceView({
  displayName,
  pousadaName,
  summary,
  transactions,
  canManageExpenses,
}: {
  displayName: string
  pousadaName: string
  summary: FinanceSummary
  transactions: Transaction[]
  canManageExpenses: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function togglePaid(expenseId: string, paid: boolean) {
    setError(null)
    setBusyId(expenseId)
    startTransition(async () => {
      const result = await setExpensePaidAction({ expenseId, paid })
      setBusyId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const cards = [
    {
      label: 'Recebido',
      hint: 'Pagamentos que já entraram',
      value: brl(summary.revenueConfirmed),
      icon: TrendingUp,
      tone: 'primary' as const,
    },
    {
      label: 'A receber',
      hint: 'Saldo em aberto das reservas ativas',
      value: brl(summary.revenuePending),
      icon: Clock,
      tone: 'ocean' as const,
    },
    {
      label: 'Despesas',
      hint:
        summary.expensesPending > 0
          ? `${brl(summary.expensesPending)} ainda a pagar`
          : 'Todas pagas',
      value: brl(summary.expensesTotal),
      icon: ArrowDownCircle,
      tone: 'accent' as const,
    },
    {
      label: 'Saldo em caixa',
      hint: 'Recebido − despesas pagas',
      value: brl(summary.balance),
      icon: Scale,
      tone: 'primary' as const,
    },
  ]

  return (
    <DashboardShell
      nav={ownerDashboardNav('financeiro')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Financeiro"
      subtitle="Receitas, despesas e fluxo de caixa da sua pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <span
              className={`flex size-10 items-center justify-center rounded-xl ${
                c.tone === 'ocean'
                  ? 'bg-ocean/10 text-ocean'
                  : c.tone === 'accent'
                    ? 'bg-accent/15 text-accent'
                    : 'bg-primary/10 text-primary'
              }`}
            >
              <c.icon className="size-5" />
            </span>
            <div className="text-foreground mt-4 text-2xl font-semibold">{c.value}</div>
            <div className="text-muted-foreground text-sm">{c.label}</div>
            <div className="text-muted-foreground/80 mt-0.5 text-xs">{c.hint}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <h2 className="text-foreground font-semibold">Extrato</h2>
          <p className="text-muted-foreground text-sm">
            Receitas de reservas (confirmadas, em estadia, concluídas e aguardando pagamento) e
            despesas lançadas.
          </p>
          <div className="mt-4 overflow-x-auto">
            {transactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Sem movimentações"
                description="As receitas das reservas e as despesas que você lançar aparecem aqui."
              />
            ) : (
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {canManageExpenses && <TableHead className="w-0" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const situation = statusBadge(t)
                    const busy = isPending && busyId === t.expenseId
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground">{fmtDate(t.date)}</TableCell>
                        <TableCell className="text-foreground font-medium">
                          {t.bookingId ? (
                            <Link
                              href={`/dashboard/reservas/${t.bookingId}`}
                              className="hover:underline"
                            >
                              {t.description}
                            </Link>
                          ) : (
                            t.description
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.kind === 'receita' ? 'primarySoft' : 'accentSoft'}
                            size="sm"
                          >
                            {t.kind === 'receita' ? 'Receita' : 'Despesa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={situation.variant} size="sm">
                            {situation.label}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${t.kind === 'receita' ? 'text-primary' : 'text-accent'}`}
                        >
                          {t.kind === 'receita' ? '+' : '−'} {brl(t.amount)}
                        </TableCell>
                        {canManageExpenses && (
                          <TableCell className="text-right">
                            {t.expenseId && (
                              <Button
                                type="button"
                                size="xs"
                                variant={t.status === 'pago' ? 'ghost' : 'secondary'}
                                disabled={isPending}
                                onClick={() =>
                                  t.expenseId && togglePaid(t.expenseId, t.status !== 'pago')
                                }
                                title={t.status === 'pago' ? 'Reabrir despesa' : 'Marcar como paga'}
                              >
                                {t.status === 'pago' ? (
                                  <RotateCcw className="size-3" />
                                ) : (
                                  <Check className="size-3" />
                                )}
                                {busy ? '…' : t.status === 'pago' ? 'Reabrir' : 'Paga'}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            {error && <p className="text-destructive mt-3 text-sm font-medium">{error}</p>}
          </div>
        </Card>

        {canManageExpenses ? (
          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Lançar despesa</h2>
            <p className="text-muted-foreground text-sm">Registre uma conta a pagar.</p>
            <div className="mt-4">
              <ExpenseForm />
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Lançar despesa</h2>
            <p className="text-muted-foreground text-sm">
              Só o proprietário e o gestor da pousada lançam e quitam despesas.
            </p>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}
