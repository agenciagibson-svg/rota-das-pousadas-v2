import 'server-only'
import type { ListQuery, Paginated, Pousada } from '@/types'
import { pousadas as mockData } from '@/lib/data'
import { assertNotMockInProduction, isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseStaticClient } from '@/lib/supabase/static'
import type { Database } from '@/lib/supabase/database.types'
import { normalizeCatalogText, parseCatalogQuery } from '@/features/pousadas/search'

/**
 * Contrato de acesso a dados de Pousadas. Única camada que fala com o banco.
 * NÃO contém regra de negócio (isso pertence aos Services).
 */
export interface PousadaRepository {
  list(query: ListQuery): Promise<Paginated<Pousada>>
  findBySlug(slug: string): Promise<Pousada | null>
  listSlugs(): Promise<string[]>
  listExcluding(slug: string, limit: number): Promise<Pousada[]>
}

const DEFAULT_PAGE_SIZE = 24

function paginate<T>(items: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  }
}

function matches(p: Pousada, search: string): boolean {
  return normalizeCatalogText(
    [p.name, p.city, p.state, p.description, ...p.tags].join(' '),
  ).includes(normalizeCatalogText(search))
}

// ---------------------------------------------------------------------------
// Implementação MOCK (ativa até o Supabase estar configurado).
// ---------------------------------------------------------------------------
const mockRepository: PousadaRepository = {
  async list(query) {
    const { search, page = 1, pageSize = DEFAULT_PAGE_SIZE } = query
    // Sem invent?rio real, o modo demonstra??o n?o pode confirmar disponibilidade.
    const items =
      query.checkin || query.guests ? [] : mockData.filter((p) => !search || matches(p, search))
    items.sort((a, b) => a.slug.localeCompare(b.slug))
    return paginate(items, page, pageSize)
  },
  async findBySlug(slug) {
    return mockData.find((p) => p.slug === slug) ?? null
  },
  async listSlugs() {
    return mockData.map((p) => p.slug)
  },
  async listExcluding(slug, limit) {
    return mockData.filter((p) => p.slug !== slug).slice(0, limit)
  },
}

// ---------------------------------------------------------------------------
// Implementação SUPABASE (ativa quando as credenciais existem).
// ---------------------------------------------------------------------------
type PousadaRow = Database['public']['Tables']['pousadas']['Row']

function rowToPousada(r: PousadaRow): Pousada {
  return {
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    image: r.image,
    gallery: r.gallery,
    rating: Number(r.rating),
    reviews: r.reviews,
    pricePerNight: Number(r.price_per_night),
    tags: r.tags,
    description: r.description,
    instagram: r.instagram,
    // Campos abaixo faltam quando a linha vem de `search_public_pousadas`
    // (RPC de busca, que só seleciona as colunas da vitrine) — `undefined`
    // nesse caso é esperado, e a página de detalhe (que usa `.select('*')`
    // de verdade) é a única que precisa deles.
    id: r.id,
    address: r.address,
    cep: r.cep,
    checkinTime: r.checkin_time,
    checkoutTime: r.checkout_time,
    cancellationPolicy: r.cancellation_policy,
    houseRules: r.house_rules,
    whatsapp: r.whatsapp,
    contactPhone: r.contact_phone,
  }
}

const supabaseRepository: PousadaRepository = {
  async list(query) {
    const filters = parseCatalogQuery(query)
    const supabase = createSupabaseStaticClient()
    const { data, error } = await supabase.rpc('search_public_pousadas', {
      p_search: filters.search ?? '',
      p_page: filters.page,
      p_page_size: filters.pageSize,
      p_checkin: filters.checkin,
      p_checkout: filters.checkout,
      p_guests: filters.guests,
    })
    if (error) throw error
    const result = data as {
      items: PousadaRow[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    return { ...result, items: result.items.map((row) => rowToPousada({ ...row, gallery: [] })) }
  },
  async findBySlug(slug) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('pousadas')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'publicada')
      .maybeSingle()
    if (error) throw error
    return data ? rowToPousada(data) : null
  },
  async listSlugs() {
    // Usado por generateStaticParams (build) e sitemap — cliente sem cookies.
    const supabase = createSupabaseStaticClient()
    const { data, error } = await supabase.from('pousadas').select('slug').eq('status', 'publicada')
    if (error) throw error
    return (data ?? []).map((r) => r.slug)
  },
  async listExcluding(slug, limit) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('pousadas')
      .select('*')
      .eq('status', 'publicada')
      .neq('slug', slug)
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(rowToPousada)
  },
}

/** Resolve a implementação conforme o ambiente. */
export function getPousadaRepository(): PousadaRepository {
  assertNotMockInProduction()
  return isSupabaseConfigured() ? supabaseRepository : mockRepository
}

export type NewPousadaAdmin = {
  slug: string
  name: string
  city: string
  state: string
  description: string
  pricePerNight: number
  instagram: string
  image: string
  gallery: string[]
  notificationEmail: string
  whatsapp: string
  status: PousadaRow['status']
}

/**
 * Cadastro de pousada pelo admin (equipe da plataforma), sem proprietário
 * vinculado ainda. A RLS `pousadas_insert` (0083) só aceita comercial/master
 * (`auth_can_manage_pousadas_platform()`), o mesmo recorte do Service
 * (`assertCanCreate`). O dono cadastra pela RPC `create_pousada`.
 */
export async function insertPousadaAsAdmin(
  input: NewPousadaAdmin,
): Promise<{ id: string; slug: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .insert({
      slug: input.slug,
      name: input.name,
      city: input.city,
      state: input.state.toUpperCase(),
      description: input.description,
      price_per_night: input.pricePerNight,
      instagram: input.instagram,
      image: input.image,
      gallery: input.gallery,
      notification_email: input.notificationEmail,
      whatsapp: input.whatsapp,
      status: input.status,
    })
    .select('id, slug')
    .single()
  if (error) throw error
  return { id: data.id, slug: data.slug }
}

/** Remove uma pousada — usado para desfazer o cadastro admin se a acomodação padrão falhar ao ser criada. */
export async function deletePousada(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('pousadas').delete().eq('id', id)
  if (error) throw error
}
