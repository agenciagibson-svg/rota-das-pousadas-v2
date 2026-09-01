import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AccommodationCategory, AccommodationStatus } from '@/features/acomodacoes/types'

export type NewCategory = {
  pousadaId: string
  name: string
  code: string | null
  description: string
  defaultCapacity: number
  maxCapacity: number | null
  defaultBedCount: number
  basePriceSuggestion: number | null
  displayOrder: number
  createdBy: string
}
export type UpdateCategory = Omit<NewCategory, 'pousadaId' | 'createdBy'>

export async function listCategoriesByPousada(pousadaId: string): Promise<AccommodationCategory[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('accommodation_categories')
    .select('id, name, code, description, default_capacity, max_capacity, default_bed_count, base_price_suggestion, display_order, status, rooms(id)')
    .eq('pousada_id', pousadaId)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description,
    defaultCapacity: c.default_capacity,
    maxCapacity: c.max_capacity,
    defaultBedCount: c.default_bed_count,
    basePriceSuggestion: c.base_price_suggestion,
    displayOrder: c.display_order,
    status: c.status as AccommodationStatus,
    roomCount: Array.isArray(c.rooms) ? c.rooms.length : 0,
  }))
}

export async function getCategoryById(id: string): Promise<{ id: string; pousadaId: string } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('accommodation_categories').select('id, pousada_id').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, pousadaId: data.pousada_id }
}

export async function insertCategory(row: NewCategory): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('accommodation_categories')
    .insert({
      pousada_id: row.pousadaId,
      name: row.name,
      code: row.code,
      description: row.description,
      default_capacity: row.defaultCapacity,
      max_capacity: row.maxCapacity,
      default_bed_count: row.defaultBedCount,
      base_price_suggestion: row.basePriceSuggestion,
      display_order: row.displayOrder,
      created_by: row.createdBy,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function updateCategory(id: string, row: UpdateCategory): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('accommodation_categories')
    .update({
      name: row.name,
      code: row.code,
      description: row.description,
      default_capacity: row.defaultCapacity,
      max_capacity: row.maxCapacity,
      default_bed_count: row.defaultBedCount,
      base_price_suggestion: row.basePriceSuggestion,
      display_order: row.displayOrder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

/** Inativa — nunca exclui fisicamente (preserva histórico e categorias já usadas). */
export async function setCategoryStatus(id: string, status: AccommodationStatus): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('accommodation_categories')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
