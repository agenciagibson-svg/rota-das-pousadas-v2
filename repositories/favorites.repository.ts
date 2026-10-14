import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PUBLIC_POUSADA_COLUMNS, type PublicPousadaRow } from '@/repositories/pousadas.repository'
import type { Pousada } from '@/types'

function rowToPousada(row: PublicPousadaRow): Pousada {
  return {
    slug: row.slug,
    name: row.name,
    city: row.city,
    state: row.state,
    image: row.image,
    gallery: row.gallery,
    rating: Number(row.rating),
    reviews: row.reviews,
    pricePerNight: Number(row.price_per_night),
    tags: row.tags,
    description: row.description,
    instagram: row.instagram,
  }
}

async function getPublishedPousadaIdBySlug(slug: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'publicada')
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function isPousadaFavorite(userId: string, slug: string): Promise<boolean> {
  const pousadaId = await getPublishedPousadaIdBySlug(slug)
  if (!pousadaId) return false

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('favorites')
    .select('pousada_id')
    .eq('user_id', userId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

/**
 * Garante o favorito, sem alternar. `upsert` com `ignoreDuplicates`: dois
 * envios ao mesmo tempo (duplo clique, duas abas) terminam os dois com a
 * pousada salva — com "confere e alterna", o segundo desfazia o primeiro.
 */
export async function addPousadaFavorite(userId: string, slug: string): Promise<void> {
  const pousadaId = await getPublishedPousadaIdBySlug(slug)
  if (!pousadaId) throw new Error('Pousada não encontrada.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('favorites')
    .upsert(
      { user_id: userId, pousada_id: pousadaId },
      { onConflict: 'user_id,pousada_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

export async function togglePousadaFavorite(
  userId: string,
  slug: string,
): Promise<{ favorite: boolean }> {
  const pousadaId = await getPublishedPousadaIdBySlug(slug)
  if (!pousadaId) throw new Error('Pousada não encontrada.')

  const supabase = await createSupabaseServerClient()
  const { data: existing, error: existingError } = await supabase
    .from('favorites')
    .select('pousada_id')
    .eq('user_id', userId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('pousada_id', pousadaId)
    if (error) throw error
    return { favorite: false }
  }

  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, pousada_id: pousadaId })
  if (error) throw error
  return { favorite: true }
}

export async function listFavoritePousadas(userId: string): Promise<Pousada[]> {
  const supabase = await createSupabaseServerClient()
  const { data: favorites, error } = await supabase
    .from('favorites')
    .select('pousada_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!favorites?.length) return []

  const ids = favorites.map((favorite) => favorite.pousada_id)
  const { data: pousadas, error: pousadasError } = await supabase
    .from('pousadas')
    .select(PUBLIC_POUSADA_COLUMNS)
    .in('id', ids)
    .eq('status', 'publicada')
  if (pousadasError) throw pousadasError

  const byId = new Map((pousadas ?? []).map((pousada) => [pousada.id, rowToPousada(pousada)]))
  return ids.map((id) => byId.get(id)).filter((pousada): pousada is Pousada => Boolean(pousada))
}
