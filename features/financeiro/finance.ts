import type { BookingStatus } from '@/features/reservas/types'
import type { FinanceSummary } from './types'

/**
 * Status de reserva que contam como receita realizada. São os valores do enum
 * `booking_status` do banco (0032) — em inglês. A versão anterior comparava
 * rótulos em português (`confirmada`, `aguardando_pagamento`) que nunca
 * chegavam aqui, e o Financeiro mostrava R$ 0 para sempre.
 */
const REALIZED: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'confirmed',
  'checked_in',
  'checked_out',
])
const PENDING: BookingStatus = 'pending'

/** Reserva entra no fluxo de caixa? (cotação, cancelada e no-show ficam fora.) */
export function countsAsRevenue(status: string): boolean {
  return REALIZED.has(status as BookingStatus) || status === PENDING
}

export type RevenueSource = {
  total: number
  /** Quanto já entrou de fato (bookings.amount_received). */
  received: number
  status: string
}
export type ExpenseSource = { amount: number; paid: boolean }

const CLOSED: ReadonlySet<string> = new Set(['cancelled', 'no_show', 'quote'])

/**
 * Cálculo puro do resumo financeiro (determinístico e testável), pelo
 * DINHEIRO e não pelo status da reserva:
 * - Recebido = o que já entrou (pagamentos registrados), qualquer status —
 *   inclusive sinal de reserva depois cancelada, que continua no caixa até
 *   ser estornado.
 * - A receber = saldo em aberto das reservas ativas (pendente, confirmada,
 *   em estadia, concluída). Confirmada com sinal pago entra só no restante.
 * - Saldo em caixa = recebido − despesas já pagas. Despesa a pagar ainda não
 *   saiu da conta, então não reduz o saldo (aparece em "a pagar").
 */
export function buildSummary(revenues: RevenueSource[], expenses: ExpenseSource[]): FinanceSummary {
  let received = 0
  let receivable = 0
  for (const r of revenues) {
    if (r.status === 'quote') continue
    received += Math.max(0, r.received)
    if (!CLOSED.has(r.status)) receivable += Math.max(0, r.total - r.received)
  }

  let expensesTotal = 0
  let expensesPending = 0
  for (const e of expenses) {
    expensesTotal += e.amount
    if (!e.paid) expensesPending += e.amount
  }
  const expensesPaid = expensesTotal - expensesPending

  return {
    revenueTotal: received + receivable,
    revenueConfirmed: received,
    revenuePending: receivable,
    expensesTotal,
    expensesPending,
    balance: received - expensesPaid,
  }
}
