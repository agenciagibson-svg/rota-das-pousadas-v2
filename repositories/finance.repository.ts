import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Expense } from '@/features/financeiro/types'

export type NewExpense = {
  pousadaId: string
  description: string
  amount: number
  category: string
  dueDate: string | null
}

export async function listExpensesByPousada(pousadaId: string): Promise<Expense[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, amount, category, due_date, paid, created_at')
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    category: r.category,
    dueDate: r.due_date,
    paid: r.paid,
    createdAt: r.created_at,
  }))
}

export async function insertExpense(row: NewExpense): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      pousada_id: row.pousadaId,
      description: row.description,
      amount: row.amount,
      category: row.category,
      due_date: row.dueDate,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}
