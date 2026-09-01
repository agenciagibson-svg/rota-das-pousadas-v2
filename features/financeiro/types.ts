export type ExpenseCategory =
  | 'manutencao'
  | 'pessoal'
  | 'insumos'
  | 'marketing'
  | 'impostos'
  | 'outros'

export type Expense = {
  id: string
  description: string
  amount: number
  category: string
  dueDate: string | null
  paid: boolean
  createdAt: string
}

/** Item unificado do fluxo (receita de reserva ou despesa lançada). */
export type Transaction = {
  id: string
  kind: 'receita' | 'despesa'
  description: string
  amount: number
  date: string
  status: string
}

/** Resumo financeiro da pousada (valores em reais inteiros). */
export type FinanceSummary = {
  revenueTotal: number
  revenueConfirmed: number
  revenuePending: number
  expensesTotal: number
  expensesPending: number
  balance: number
}
