import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

/** Ofertas para ex-hóspedes (0111). Toda regra fica nas RPCs. */

export type OfferConsent = {
  pousadaId: string
  pousadaName: string
  pousadaSlug: string
  granted: boolean
}

export type ActiveOffer = {
  deliveryId: string
  pousadaName: string
  pousadaSlug: string
  code: string
  percent: number
  validUntil: string
  stayFrom: string | null
  stayUntil: string | null
  message: string
}

export type OfferReportRow = {
  offerId: string
  kind: string
  percent: number
  validDays: number
  stayFrom: string | null
  stayUntil: string | null
  message: string
  createdAt: string
  recipients: number
  emailed: number
  opened: number
  booked: number
  revenue: number
}

export type OfferEmailTarget = {
  deliveryId: string
  email: string
  guestName: string
  pousadaName: string
  pousadaSlug: string
  code: string
  percent: number
  validUntil: string
  stayFrom: string | null
  stayUntil: string | null
  message: string
}

export async function setOfferConsentRpc(pousadaId: string, granted: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_offer_consent', {
    p_pousada_id: pousadaId,
    p_granted: granted,
  })
  if (error) throw new Error(error.message)
}

export async function listMyOfferConsentsRpc(): Promise<OfferConsent[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('my_offer_consents')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    pousadaId: r.pousada_id,
    pousadaName: r.pousada_name,
    pousadaSlug: r.pousada_slug,
    granted: r.granted,
  }))
}

export async function listMyActiveOffersRpc(): Promise<ActiveOffer[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('my_active_offers')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    deliveryId: r.delivery_id,
    pousadaName: r.pousada_name,
    pousadaSlug: r.pousada_slug,
    code: r.code,
    percent: Number(r.percent),
    validUntil: r.valid_until,
    stayFrom: r.stay_from,
    stayUntil: r.stay_until,
    message: r.message,
  }))
}

export async function markOfferOpenedRpc(code: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('mark_offer_opened', { p_code: code })
  if (error) throw new Error(error.message)
}

export async function sendPousadaOfferRpc(p: {
  pousadaId: string
  percent: number
  validDays: number
  stayFrom: string | null
  stayUntil: string | null
  message: string
}): Promise<{ offerId: string | null; sent: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('send_pousada_offer', {
    p_pousada_id: p.pousadaId,
    p_percent: p.percent,
    p_valid_days: p.validDays,
    p_stay_from: p.stayFrom,
    p_stay_until: p.stayUntil,
    p_message: p.message,
  })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { offerId?: string | null; sent?: number }
  return { offerId: r.offerId ?? null, sent: Number(r.sent) || 0 }
}

export async function countOfferAudienceRpc(
  pousadaId: string,
): Promise<{ consented: number; reachable: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('count_offer_audience', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { consented?: number; reachable?: number }
  return { consented: Number(r.consented) || 0, reachable: Number(r.reachable) || 0 }
}

export async function getOfferReportRpc(pousadaId: string): Promise<OfferReportRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_pousada_offer_report', {
    p_pousada_id: pousadaId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    offerId: r.offer_id,
    kind: r.kind,
    percent: Number(r.percent),
    validDays: Number(r.valid_days),
    stayFrom: r.stay_from,
    stayUntil: r.stay_until,
    message: r.message,
    createdAt: r.created_at,
    recipients: Number(r.recipients),
    emailed: Number(r.emailed),
    opened: Number(r.opened),
    booked: Number(r.booked),
    revenue: Number(r.revenue),
  }))
}

// Rodada de e-mails (service_role, sem sessão).
export async function listOfferEmailsDueRpc(limit: number): Promise<OfferEmailTarget[]> {
  const { data, error } = await createSupabaseServiceRoleClient().rpc('list_offer_emails_due', {
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    deliveryId: r.delivery_id,
    email: r.email,
    guestName: r.guest_name,
    pousadaName: r.pousada_name,
    pousadaSlug: r.pousada_slug,
    code: r.code,
    percent: Number(r.percent),
    validUntil: r.valid_until,
    stayFrom: r.stay_from,
    stayUntil: r.stay_until,
    message: r.message,
  }))
}

export async function markOfferEmailRpc(deliveryId: string, sent: boolean): Promise<void> {
  const { error } = await createSupabaseServiceRoleClient().rpc('mark_offer_email', {
    p_delivery_id: deliveryId,
    p_sent: sent,
  })
  if (error) throw new Error(error.message)
}
