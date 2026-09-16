import type { BookingStatus } from '@/features/reservas/types'
import type { FinanceSummary } from './types'

/**
 * Status de reserva que contam como receita realizada. São os valores do enum
 * `booking_status` do banco (0032) — em inglês. A versão anterior comparava
 * rótulos em português (`confirmada`, `aguardando_pagamento`) que nunca
 * chegavam aqui, e o Financeiro mostrava R$ 0 para sempre.
 */
const REALIZED: ReadonlySet<BookingStatus> = new Set<BookingStatus>(['confirmed', 'checked_in', 'checked_out'])
const PENDING: BookingStatus = 'pending'

/** Reserva entra no fluxo de caixa? (cotação, cancelada e no-show ficam fora.) */
export function countsAsRevenue(status: string): boolean {
  return REALIZED.has(status as BookingStatus) || status === PENDING
}

export type RevenueSource = { total: number; status: string }
export type ExpenseSource = { amount: number; paid: boolean }

/**
 * Cálculo puro do resumo financeiro (determinístico e testável).
 * Receita realizada = reservas confirmadas/em estadia/concluídas.
 * A receber = reservas aguardando pagamento. Saldo = realizada − despesas.
 */
export function buildSummary(
  revenues: RevenueSource[],
  expenses: ExpenseSource[],
): FinanceSummary {
  let revenueConfirmed = 0
  let revenuePending = 0
  for (const r of revenues) {
    if (REALIZED.has(r.status as BookingStatus)) revenueConfirmed += r.total
    else if (r.status === PENDING) revenuePending += r.total
  }

  let expensesTotal = 0
  let expensesPending = 0
  for (const e of expenses) {
    expensesTotal += e.amount
    if (!e.paid) expensesPending += e.amount
  }

  return {
    revenueTotal: revenueConfirmed + revenuePending,
    revenueConfirmed,
    revenuePending,
    expensesTotal,
    expensesPending,
    balance: revenueConfirmed - expensesTotal,
  }
}
