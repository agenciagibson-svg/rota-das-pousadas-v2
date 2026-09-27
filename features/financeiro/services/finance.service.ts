import 'server-only'
import { getOwnerPousada } from '@/features/gestao/services/pms.service'
import { getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { listReservationsByPousada } from '@/repositories/management.repository'
import {
  listExpensesByPousada,
  insertExpense,
  setExpensePaid,
} from '@/repositories/finance.repository'
import { buildSummary, countsAsRevenue } from '@/features/financeiro/finance'
import {
  consumptionTotalsByPousada,
  listConsumptionPaymentsByPousada,
} from '@/repositories/orders.repository'
import { PAYMENT_METHOD_LABEL, type ConsumptionPayment } from '@/features/pedidos/types'
import type { FinanceSummary, Transaction } from '@/features/financeiro/types'
import type { CreateExpenseInput } from '@/features/financeiro/schemas'

export type FinanceData = {
  summary: FinanceSummary
  transactions: Transaction[]
}

const EMPTY: FinanceData = {
  summary: {
    revenueTotal: 0,
    revenueConfirmed: 0,
    revenuePending: 0,
    expensesTotal: 0,
    expensesPending: 0,
    balance: 0,
  },
  transactions: [],
}

/** Papel ativo pode ver o financeiro? (`finance:pousada:view` — proprietário, gestor, financeiro.) */
export async function canViewFinance(): Promise<boolean> {
  const role = await getActiveTenantRole()
  return !!role && can(role, 'finance:pousada:view')
}

/** Papel ativo pode lançar/quitar despesa? Espelha a RLS `expenses_write` (proprietário/gestor). */
export async function canManageExpenses(): Promise<boolean> {
  const role = await getActiveTenantRole()
  return !!role && can(role, 'pousada:edit')
}

/**
 * Resumo + extrato financeiro da pousada ativa. Para quem não tem
 * `finance:pousada:view` devolve vazio (a página mostra "sem permissão") —
 * a RLS de `expenses` (0020) já esconde as despesas, mas a receita das
 * reservas passaria, e recepção/governança não devem ver faturamento.
 */
export async function getFinance(): Promise<FinanceData> {
  const [pousada, allowed] = await Promise.all([getOwnerPousada(), canViewFinance()])
  if (!pousada || !allowed) return EMPTY

  const [reservations, expenses, consumption, consumptionPayments] = await Promise.all([
    listReservationsByPousada(pousada.id),
    listExpensesByPousada(pousada.id),
    // Consumo (0078) não pode derrubar o Financeiro se algo falhar.
    consumptionTotalsByPousada(pousada.id).catch(() => []),
    listConsumptionPaymentsByPousada(pousada.id, 200).catch(() => []),
  ])
  const codeById = new Map(reservations.map((r) => [r.id, r]))

  // Cotação, cancelada e no-show não são dinheiro — nem no resumo nem no extrato.
  const revenueReservations = reservations.filter((r) => countsAsRevenue(r.status))

  // Resumo pelo dinheiro que entrou (total − saldo em aberto), de todas as
  // reservas: sinal de reserva cancelada ainda está no caixa até o estorno.
  // Conta de consumo entra como mais uma fonte: consumido = total,
  // pagamentos do consumo = recebido.
  const summary = buildSummary(
    [
      ...reservations.map((r) => ({
        total: r.total,
        received: Math.max(0, r.total - r.balanceDue),
        status: r.status,
      })),
      ...consumption.map((c) => ({ total: c.delivered, received: c.paid, status: 'confirmed' })),
    ],
    expenses.map((e) => ({ amount: e.amount, paid: e.paid })),
  )

  const transactions: Transaction[] = [
    ...revenueReservations.map((r) => ({
      id: `b-${r.id}`,
      kind: 'receita' as const,
      description: `Reserva ${r.code} · ${r.guestName}`,
      amount: r.total,
      date: r.checkin,
      status: r.status,
      bookingId: r.id,
    })),
    ...consumptionPayments.map((p) => {
      const r = codeById.get(p.booking_id)
      return {
        id: `c-${p.id}`,
        kind: 'receita' as const,
        description: `Consumo ${r ? `· Reserva ${r.code} · ${r.guestName}` : ''} (${
          PAYMENT_METHOD_LABEL[p.method as ConsumptionPayment['method']] ?? p.method
        })`,
        amount: Number(p.amount),
        date: p.created_at.slice(0, 10),
        status: 'pago',
        bookingId: p.booking_id,
      }
    }),
    ...expenses.map((e) => ({
      id: `e-${e.id}`,
      kind: 'despesa' as const,
      description: e.description,
      amount: e.amount,
      date: e.dueDate ?? e.createdAt.slice(0, 10),
      status: e.paid ? 'pago' : 'a_pagar',
      expenseId: e.id,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  return { summary, transactions }
}

/** Lança uma despesa para a pousada ativa. */
export async function addExpense(input: CreateExpenseInput): Promise<void> {
  const pousada = await getOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  if (!(await canManageExpenses())) throw new Error('Você não tem permissão para lançar despesas.')
  await insertExpense({
    pousadaId: pousada.id,
    description: input.description,
    amount: input.amount,
    category: input.category,
    dueDate: input.dueDate ? input.dueDate : null,
  })
}

/** Marca uma despesa como paga (ou reabre). */
export async function markExpensePaid(expenseId: string, paid: boolean): Promise<void> {
  const pousada = await getOwnerPousada()
  if (!pousada) throw new Error('Nenhuma pousada sob sua gestão.')
  if (!(await canManageExpenses())) throw new Error('Você não tem permissão para alterar despesas.')
  await setExpensePaid(pousada.id, expenseId, paid)
}
