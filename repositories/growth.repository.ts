import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Activity, GrowthProfile, GrowthStage, Opportunity } from '@/features/admin/growth'
import type { ReportBooking } from '@/features/admin/report-metrics'

type ProfileRow = {
  pousada_id: string
  photos: number
  has_cover: boolean
  description_len: number
  has_mercado_pago: boolean
  has_pix: boolean
  active_rooms: number
  reviews_count: number
  owner_name: string | null
  owner_email: string | null
  whatsapp: string | null
  phone: string | null
}

const toProfile = (r: ProfileRow): GrowthProfile => ({
  pousadaId: r.pousada_id,
  photos: Number(r.photos) || 0,
  hasCover: !!r.has_cover,
  descriptionLen: Number(r.description_len) || 0,
  hasMercadoPago: !!r.has_mercado_pago,
  hasPix: !!r.has_pix,
  activeRooms: Number(r.active_rooms) || 0,
  reviewsCount: Number(r.reviews_count) || 0,
  ownerName: r.owner_name,
  ownerEmail: r.owner_email,
  whatsapp: r.whatsapp,
  phone: r.phone,
})

export async function listGrowthProfiles(): Promise<GrowthProfile[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('growth_profiles', {})
  if (error) throw new Error(error.message)
  return ((data ?? []) as ProfileRow[]).map(toProfile)
}

export async function getGrowthProfile(pousadaId: string): Promise<GrowthProfile | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('growth_profiles', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as ProfileRow[])[0]
  return row ? toProfile(row) : null
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('growth_opportunities')
    .select(
      'pousada_id, stage, service_fee, ad_budget, next_contact, campaign_start, campaign_end, owner_interest_at, lost_reason, updated_at',
    )
  if (error) throw new Error(error.message)
  return (data ?? []).map((o) => ({
    pousadaId: o.pousada_id,
    stage: o.stage as GrowthStage,
    serviceFee: o.service_fee === null ? null : Number(o.service_fee),
    adBudget: o.ad_budget === null ? null : Number(o.ad_budget),
    nextContact: o.next_contact,
    campaignStart: o.campaign_start,
    campaignEnd: o.campaign_end,
    ownerInterestAt: o.owner_interest_at,
    lostReason: o.lost_reason ?? '',
    updatedAt: o.updated_at,
  }))
}

/** Histórico recente (as 2000 anotações mais novas bastam para a tela). */
export async function listActivities(): Promise<Activity[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('growth_activities')
    .select('id, pousada_id, kind, body, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error(error.message)
  const authors = [...new Set((data ?? []).map((a) => a.created_by).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (authors.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authors)
    for (const p of profiles ?? []) names.set(p.id, p.full_name)
  }
  return (data ?? []).map((a) => ({
    id: a.id,
    pousadaId: a.pousada_id,
    kind: a.kind as Activity['kind'],
    body: a.body,
    author: a.created_by ? (names.get(a.created_by) ?? null) : null,
    createdAt: a.created_at,
  }))
}

/** Reservas das pousadas em campanha, desde 90 dias antes do início mais antigo. */
export async function listCampaignBookings(
  pousadaIds: string[],
  sinceIso: string,
): Promise<ReportBooking[]> {
  if (pousadaIds.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const out: ReportBooking[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase
      .from('bookings')
      .select('pousada_id, status, origin, total, checkin, checkout, created_at')
      .in('pousada_id', pousadaIds)
      .gte('created_at', sinceIso)
      .order('created_at')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const b of data ?? [])
      out.push({
        pousadaId: b.pousada_id,
        status: b.status,
        origin: b.origin,
        total: Number(b.total) || 0,
        checkin: b.checkin,
        checkout: b.checkout,
        createdAt: b.created_at,
      })
    if ((data ?? []).length < 1000) break
  }
  return out
}

export async function saveOpportunityRpc(input: {
  pousadaId: string
  stage: GrowthStage
  serviceFee: number | null
  adBudget: number | null
  nextContact: string | null
  campaignStart: string | null
  campaignEnd: string | null
  lostReason: string
}) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('save_growth_opportunity', {
    p_pousada_id: input.pousadaId,
    p_stage: input.stage,
    p_service_fee: input.serviceFee,
    p_ad_budget: input.adBudget,
    p_next_contact: input.nextContact,
    p_campaign_start: input.campaignStart,
    p_campaign_end: input.campaignEnd,
    p_lost_reason: input.lostReason,
  })
  if (error) throw new Error(error.message)
}

export async function addActivityRpc(pousadaId: string, kind: 'nota' | 'contato', body: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('add_growth_activity', {
    p_pousada_id: pousadaId,
    p_kind: kind,
    p_body: body,
  })
  if (error) throw new Error(error.message)
}

export async function requestGrowthHelpRpc(pousadaId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('request_growth_help', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  return data as { interestAt: string; duplicate: boolean }
}

export type GrowthStatus = {
  stage: GrowthStage
  interestAt: string | null
  campaignStart: string | null
  campaignEnd: string | null
}

export async function getGrowthStatusRpc(pousadaId: string): Promise<GrowthStatus> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_growth_status', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as Record<string, string | null>
  return {
    stage: (r.stage as GrowthStage) ?? 'a_oferecer',
    interestAt: r.interestAt ?? null,
    campaignStart: r.campaignStart ?? null,
    campaignEnd: r.campaignEnd ?? null,
  }
}
