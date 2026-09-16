'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { createExpenseSchema, setExpensePaidSchema } from './schemas'
import { addExpense, markExpensePaid } from './services/finance.service'

export const createExpenseAction = createAction(createExpenseSchema, async (input) => {
  await addExpense(input)
  revalidatePath('/dashboard/financeiro')
  return { ok: true as const }
})

export const setExpensePaidAction = createAction(setExpensePaidSchema, async (input) => {
  await markExpensePaid(input.expenseId, input.paid)
  revalidatePath('/dashboard/financeiro')
  revalidatePath('/dashboard')
  return { expenseId: input.expenseId, paid: input.paid }
})
