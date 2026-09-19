import 'server-only'
import type { Destination, Experience, Season } from '@/types'
import { destinations as mockDestinations, experiences as mockExperiences } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { AdminDestinationRow } from '@/features/admin/types'

export interface DestinationRepository {
  list(): Promise<Destination[]>
  findBySlug(slug: string): Promise<Destination | null>
  /** Experiências são taxonomia de referência (dados de aplicação). */
  listExperiences(): Promise<Experience[]>
}

const mockRepository: DestinationRepository = {
  async list() {
    return mockDestinations
  },
  async findBySlug(slug) {
    return mockDestinations.find((d) => d.slug === slug) ?? null
  },
  async listExperiences() {
    return mockExperiences
  },
}

type DestinationRow = Database['public']['Tables']['destinations']['Row']

/**
 * Nº de pousadas PUBLICADAS por destino, calculado ao vivo a partir de
 * `pousadas.destination_id` — nunca mais o valor congelado da coluna
 * `pousadas_count` (achado da avaliação de 19/09/2026: nada nunca populava
 * essa coluna, então a home sempre exibiu "0 pousadas" para todo destino).
 * `rating`/`price_from` continuam curados manualmente pela equipe — são
 * conteúdo editorial de destaque, não uma média calculada.
 */
async function countPublishedByDestination(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('pousadas')
    .select('destination_id')
    .eq('status', 'publicada')
    .not('destination_id', 'is', null)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.destination_id) continue
    counts.set(row.destination_id, (counts.get(row.destination_id) ?? 0) + 1)
  }
  return counts
}

function rowToDestination(r: DestinationRow, liveCount?: number): Destination {
  return {
    slug: r.slug,
    name: r.name,
    state: r.state,
    image: r.image,
    pousadas: liveCount ?? r.pousadas_count,
    rating: Number(r.rating),
    priceFrom: Number(r.price_from),
    season: r.season as Destination['season'],
  }
}

const supabaseRepository: DestinationRepository = {
  async list() {
    const supabase = await createSupabaseServerClient()
    const [{ data, error }, counts] = await Promise.all([
      supabase.from('destinations').select('*'),
      countPublishedByDestination(supabase),
    ])
    if (error) throw error
    return (data ?? [])
      .map((r) => rowToDestination(r, counts.get(r.id) ?? 0))
      .sort((a, b) => b.pousadas - a.pousadas)
  },
  async findBySlug(slug) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('destinations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const counts = await countPublishedByDestination(supabase)
    return rowToDestination(data, counts.get(data.id) ?? 0)
  },
  // Taxonomia de experiências permanece como dado de referência da aplicação.
  async listExperiences() {
    return mockExperiences
  },
}

export function getDestinationRepository(): DestinationRepository {
  return isSupabaseConfigured() ? supabaseRepository : mockRepository
}

/**
 * Listagem para a tela "Destinos" do admin — inclui `id` (necessário pra
 * editar/excluir) e o `pousadasCount` ao vivo, igual ao `list()` público.
 */
export async function listDestinationsForAdmin(): Promise<AdminDestinationRow[]> {
  const supabase = await createSupabaseServerClient()
  const [{ data, error }, counts] = await Promise.all([
    supabase.from('destinations').select('*').order('name', { ascending: true }),
    countPublishedByDestination(supabase),
  ])
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    state: r.state,
    image: r.image,
    season: r.season as Season[],
    rating: Number(r.rating),
    priceFrom: Number(r.price_from),
    pousadasCount: counts.get(r.id) ?? 0,
  }))
}

export type DestinationInput = {
  slug: string
  name: string
  state: string
  image: string
  season: Season[]
  rating: number
  priceFrom: number
}

/** Cria um destino (RPC `create_destination`, 0054 — valida e audita no banco). */
export async function insertDestinationRpc(
  input: DestinationInput,
): Promise<{ id: string; slug: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_destination', {
    p_slug: input.slug,
    p_name: input.name,
    p_state: input.state,
    p_image: input.image,
    p_season: input.season,
    p_rating: input.rating,
    p_price_from: input.priceFrom,
  })
  if (error) throw new Error(error.message)
  const result = data as { id: string; slug: string }
  return result
}

/** Edita um destino existente (RPC `update_destination`, 0054). */
export async function updateDestinationRpc(
  id: string,
  input: DestinationInput,
): Promise<{ id: string; slug: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('update_destination', {
    p_id: id,
    p_slug: input.slug,
    p_name: input.name,
    p_state: input.state,
    p_image: input.image,
    p_season: input.season,
    p_rating: input.rating,
    p_price_from: input.priceFrom,
  })
  if (error) throw new Error(error.message)
  const result = data as { id: string; slug: string }
  return result
}

/** Remove um destino (RPC `delete_destination`, 0054 — bloqueia se houver pousada vinculada). */
export async function deleteDestinationRpc(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('delete_destination', { p_id: id })
  if (error) throw new Error(error.message)
}
