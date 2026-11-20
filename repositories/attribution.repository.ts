import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Channel, VisitOrigin } from '@/features/origem/origin'

/** Grava a origem da reserva recém-criada pelo viajante (0106). Devolve o canal. */
export async function recordBookingAttributionRpc(
  bookingId: string,
  origin: VisitOrigin | null,
): Promise<Channel> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('record_booking_attribution', {
    p_booking_id: bookingId,
    ...(origin?.source ? { p_utm_source: origin.source } : {}),
    ...(origin?.medium ? { p_utm_medium: origin.medium } : {}),
    ...(origin?.campaign ? { p_utm_campaign: origin.campaign } : {}),
    ...(origin?.content ? { p_utm_content: origin.content } : {}),
    ...(origin?.term ? { p_utm_term: origin.term } : {}),
    ...(origin?.referrerHost ? { p_referrer_host: origin.referrerHost } : {}),
    ...(origin?.landingPath ? { p_landing_path: origin.landingPath } : {}),
    ...(origin?.clickId ? { p_click_id: origin.clickId } : {}),
    ...(origin?.at ? { p_first_seen_at: origin.at } : {}),
  })
  if (error) throw new Error(error.message)
  return (data ?? 'direto') as Channel
}

export type BookingVisitOrigin = {
  channel: Channel
  campaign: string | null
  source: string | null
}

/** Origem das reservas da pousada (RLS: equipe operacional ou suporte com concessão). */
export async function bookingOriginsById(
  bookingIds: string[],
): Promise<Map<string, BookingVisitOrigin>> {
  const ids = [...new Set(bookingIds.filter(Boolean))]
  const out = new Map<string, BookingVisitOrigin>()
  if (ids.length === 0) return out
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('booking_attribution')
    .select('booking_id, channel, utm_campaign, utm_source')
    .in('booking_id', ids)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    out.set(r.booking_id, {
      channel: r.channel as Channel,
      campaign: r.utm_campaign ?? null,
      source: r.utm_source ?? null,
    })
  }
  return out
}

export type PlatformChannelRow = {
  channel: Channel
  created: number
  paid: number
  paidTotal: number
}

export type PlatformChannels = { month: string; channels: PlatformChannelRow[] }

/** /admin: reservas feitas pelo site no mês, por canal (RPC confere a equipe da plataforma). */
export async function listPlatformBookingChannelsRpc(
  month: string | null,
): Promise<PlatformChannels> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    'list_platform_booking_channels',
    month ? { p_month: month } : {},
  )
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { month?: string; channels?: Record<string, unknown>[] }
  return {
    month: typeof r.month === 'string' ? r.month : '',
    channels: (Array.isArray(r.channels) ? r.channels : []).map((c) => ({
      channel: String(c.channel ?? 'sem_registro') as Channel,
      created: Number(c.created ?? 0),
      paid: Number(c.paid ?? 0),
      paidTotal: Number(c.paidTotal ?? 0),
    })),
  }
}
