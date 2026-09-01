import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/database.types'
import type { PendingPousada } from '@/features/admin/types'

export type PousadaStatus = Enums<'pousada_status'>

/** Pousadas em análise (RLS: leitura permitida a platform admin). */
export async function listPendingPousadas(): Promise<PendingPousada[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select('id, slug, name, city, state, created_at')
    .eq('status', 'em_analise')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    createdAt: r.created_at,
  }))
}

/** Resolve o slug para revalidar a página pública após mudança de status. */
export async function getPousadaSlugById(id: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('pousadas').select('slug').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.slug ?? null
}

/** Atualiza o status de uma pousada (RLS: apenas platform admin pode). */
export async function setPousadaStatus(id: string, status: PousadaStatus): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('pousadas').update({ status }).eq('id', id)
  if (error) throw error
}
