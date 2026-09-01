'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { createExpenseSchema } from './schemas'
import { addExpense } from './services/finance.service'

export const createExpenseAction = createAction(createExpenseSchema, async (input) => {
  await addExpense(input)
  revalidatePath('/dashboard/financeiro')
  return { ok: true as const }
})
