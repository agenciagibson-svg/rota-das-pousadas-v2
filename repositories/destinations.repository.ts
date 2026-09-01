import 'server-only'
import type { Destination, Experience } from '@/types'
import { destinations as mockDestinations, experiences as mockExperiences } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

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

function rowToDestination(r: DestinationRow): Destination {
  return {
    slug: r.slug,
    name: r.name,
    state: r.state,
    image: r.image,
    pousadas: r.pousadas_count,
    rating: Number(r.rating),
    priceFrom: Number(r.price_from),
    season: r.season as Destination['season'],
  }
}

const supabaseRepository: DestinationRepository = {
  async list() {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.from('destinations').select('*').order('pousadas_count', { ascending: false })
    if (error) throw error
    return (data ?? []).map(rowToDestination)
  },
  async findBySlug(slug) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.from('destinations').select('*').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data ? rowToDestination(data) : null
  },
  // Taxonomia de experiências permanece como dado de referência da aplicação.
  async listExperiences() {
    return mockExperiences
  },
}

export function getDestinationRepository(): DestinationRepository {
  return isSupabaseConfigured() ? supabaseRepository : mockRepository
}
