import 'server-only'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { LinkReport, QuoteRequest, QuoteRequestStatus } from '@/features/bio/types'
import { getPousadaRepository } from './pousadas.repository'

type QuoteRow = {
  id: string
  name: string
  email: string | null
  phone: string
  checkin: string | null
  checkout: string | null
  adults: number
  children: number
  pets: boolean
  occasion: string
  message: string
  status: QuoteRequestStatus
  internal_notes: string
  handled_at: string | null
  created_at: string
}

function toQuote(row: QuoteRow): QuoteRequest {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    checkin: row.checkin,
    checkout: row.checkout,
    adults: row.adults,
    children: row.children,
    pets: row.pets,
    occasion: row.occasion,
    message: row.message,
    status: row.status,
    internalNotes: row.internal_notes,
    handledAt: row.handled_at,
    createdAt: row.created_at,
  }
}

/**
 * Registra um evento da página pública.
 *
 * Nunca propaga erro: métrica não pode derrubar a página que o hóspede está
 * tentando usar. Falhar em contar uma visita é irrelevante; falhar em mostrar
 * a pousada não é.
 */
export async function recordLinkEvent(p: {
  pousadaId: string
  event: 'view' | 'search' | 'quote_request' | 'booking_started'
  checkin?: string | null
  checkout?: string | null
  guests?: number | null
  availableCount?: number | null
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.rpc('record_link_event', {
      p_pousada_id: p.pousadaId,
      p_event: p.event,
      p_checkin: p.checkin ?? null,
      p_checkout: p.checkout ?? null,
      p_guests: p.guests ?? null,
      p_available_count: p.availableCount ?? null,
    })
  } catch {
    // Silêncio deliberado — ver comentário acima.
  }
}

/**
 * Purga pedidos de orçamento não convertidos com mais de N dias (cron
 * diário, 0059). service_role só — mesmo padrão de
 * `expireOverduePendingBookingsRpc`.
 */
export async function purgeStaleQuoteRequestsRpc(
  retentionDays = 180,
): Promise<{ deleted: number }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('purge_stale_quote_requests', {
    p_retention_days: retentionDays,
  })
  if (error) throw new Error(error.message)
  return data as { deleted: number }
}

export async function createQuoteRequestRpc(p: {
  pousadaId: string
  name: string
  phone: string
  email: string | null
  checkin: string | null
  checkout: string | null
  adults: number
  children: number
  pets: boolean
  occasion: string
  message: string
  consent: boolean
}): Promise<{ status: string; id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_quote_request', {
    p_pousada_id: p.pousadaId,
    p_name: p.name,
    p_phone: p.phone,
    p_email: p.email,
    p_checkin: p.checkin,
    p_checkout: p.checkout,
    p_adults: p.adults,
    p_children: p.children,
    p_pets: p.pets,
    p_occasion: p.occasion,
    p_message: p.message,
    p_consent: p.consent,
  })
  if (error) throw new Error(error.message)
  return data as { status: string; id: string }
}

/** Pedidos da pousada ativa — a RLS da 0046 restringe ao tenant. */
export async function listQuoteRequestsByPousada(pousadaId: string): Promise<QuoteRequest[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('quote_requests')
    .select(
      'id, name, email, phone, checkin, checkout, adults, children, pets, occasion, message, status, internal_notes, handled_at, created_at',
    )
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as QuoteRow[]).map(toQuote)
}

export async function setQuoteRequestStatusRpc(p: {
  requestId: string
  status: QuoteRequestStatus
  notes: string
}): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_quote_request_status', {
    p_request_id: p.requestId,
    p_status: p.status,
    p_notes: p.notes,
  })
  if (error) throw new Error(error.message)
}

export async function getLinkReportRpc(pousadaId: string, days: number): Promise<LinkReport> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_link_report', {
    p_pousada_id: pousadaId,
    p_days: days,
  })
  if (error) throw new Error(error.message)
  return data as unknown as LinkReport
}

export type BookableRoom = {
  id: string
  name: string
  description: string
  basePrice: number
  capacity: number
}

/**
 * Acomodações ofertáveis de uma pousada.
 *
 * Chama a mesma RPC `list_bookable_rooms` que a busca do catálogo usa (0041,
 * ampliada na 0044 para excluir também o que veio das OTAs). Sem datas, devolve
 * o inventário publicado com a diária de cada acomodação — é o que a página da
 * bio mostra antes de o visitante escolher o período.
 */
export async function listBookableRooms(
  slug: string,
  checkin: string | null,
  checkout: string | null,
  guests: number,
): Promise<BookableRoom[]> {
  if (!isSupabaseConfigured()) {
    // Modo demonstração: a acomodação padrão da pousada de exemplo.
    const p = await getPousadaRepository().findBySlug(slug)
    return p
      ? [
          {
            id: `demo-${p.slug}`,
            name: 'Acomodação principal',
            description: 'Acomodação padrão da pousada.',
            basePrice: p.pricePerNight,
            capacity: p.maxGuests ?? 4,
          },
        ]
      : []
  }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_bookable_rooms', {
    p_slug: slug,
    p_checkin: checkin,
    p_checkout: checkout,
    p_guests: guests,
  })
  if (error) throw new Error(error.message)
  return (
    (data ?? []) as {
      id: string
      name: string
      description: string
      base_price: number
      capacity: number
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    basePrice: Number(r.base_price ?? 0),
    capacity: Number(r.capacity ?? 1),
  }))
}

export type BioPousada = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  description: string
  image: string
  instagram: string
  whatsapp: string
  pricePerNight: number
  checkinTime: string
  checkoutTime: string
  published: boolean
}

/**
 * Modo demonstração (sem Supabase): a bio sai da pousada de exemplo, para a
 * página abrir no preview. Sem WhatsApp, o contato direto não aparece.
 */
async function demoBioPousada(slug: string): Promise<BioPousada | null> {
  const p = await getPousadaRepository().findBySlug(slug)
  if (!p) return null
  return {
    id: p.id ?? p.slug,
    slug: p.slug,
    name: p.name,
    city: p.city,
    state: p.state,
    description: p.description,
    image: p.image,
    instagram: p.instagram,
    whatsapp: p.whatsapp ?? '',
    pricePerNight: p.pricePerNight,
    checkinTime: p.checkinTime ?? '14:00',
    checkoutTime: p.checkoutTime ?? '12:00',
    published: true,
  }
}

/**
 * Dados da pousada para a página da bio, incluindo o `id` — que a página
 * precisa para registrar evento e para o formulário de orçamento, e que o tipo
 * de domínio `Pousada` não carrega.
 *
 * Devolve também pousada ainda não publicada: é ela que alimenta o estado
 * "em preparação". O link é entregue no cadastro e a pousada cola na bio no
 * mesmo dia — a página precisa existir antes de a curadoria aprovar.
 */
export async function getBioPousadaBySlug(slug: string): Promise<BioPousada | null> {
  if (!isSupabaseConfigured()) return demoBioPousada(slug)
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select(
      'id, slug, name, city, state, description, image, instagram, whatsapp, price_per_night, checkin_time, checkout_time, status, tenant_status',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  if (!['onboarding', 'active'].includes(data.tenant_status)) return null

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    city: data.city,
    state: data.state,
    description: data.description ?? '',
    image: data.image ?? '',
    instagram: data.instagram ?? '',
    whatsapp: data.whatsapp ?? '',
    pricePerNight: Number(data.price_per_night ?? 0),
    checkinTime: data.checkin_time ?? '14:00',
    checkoutTime: data.checkout_time ?? '12:00',
    published: data.status === 'publicada',
  }
}
