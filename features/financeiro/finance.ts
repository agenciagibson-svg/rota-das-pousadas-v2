import type { FinanceSummary } from './types'

/** Status de reserva que contam como receita realizada. */
const REALIZED = new Set(['confirmada', 'em_estadia', 'concluida'])
const PENDING_STATUS = 'aguardando_pagamento'

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
    if (REALIZED.has(r.status)) revenueConfirmed += r.total
    else if (r.status === PENDING_STATUS) revenuePending += r.total
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
