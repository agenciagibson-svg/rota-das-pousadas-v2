import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PlatformExpense } from '@/features/admin/types'

export type NewPlatformExpense = {
  description: string
  amount: number
  category: string
  dueDate: string | null
}

/**
 * Contas a pagar da própria Rota — tela "Financeiro" do painel master. RLS
 * (`platform_expenses_read`, migration 0055) restringe leitura a
 * financeiro_plataforma/master. Ordenado por vencimento (mais próximo
 * primeiro) — é uma lista de "o que vence quando", não um extrato cronológico.
 */
export async function listPlatformExpenses(): Promise<PlatformExpense[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('platform_expenses')
    .select('id, description, amount, category, due_date, paid, created_at')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    category: r.category as PlatformExpense['category'],
    dueDate: r.due_date,
    paid: r.paid,
    createdAt: r.created_at,
  }))
}

export async function insertPlatformExpense(
  row: NewPlatformExpense,
  createdBy: string,
): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('platform_expenses')
    .insert({
      description: row.description,
      amount: row.amount,
      category: row.category,
      due_date: row.dueDate,
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

/** Marca/desmarca uma despesa da Rota como paga. RLS `platform_expenses_write` é a segunda barreira. */
export async function setPlatformExpensePaid(id: string, paid: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('platform_expenses')
    .update({ paid })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Despesa não encontrada.')
}
