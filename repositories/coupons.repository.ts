import 'server-only'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { orNull } from '@/lib/supabase/rpc-args'
import type {
  Coupon,
  CouponKind,
  CouponPreview,
  CouponRejection,
  FeaturedCoupon,
} from '@/features/cupons/types'

/**
 * Cupons da pousada (0100). Tudo por RPC: as tabelas não têm escrita pela API
 * e o desconto da reserva é calculado e validado só no banco.
 */

const kindOf = (v: unknown): CouponKind => (v === 'fixed' ? 'fixed' : 'percent')

type CouponRow = {
  id: string
  code: string
  kind: string
  value: number
  valid_from: string | null
  valid_until: string | null
  stay_from: string | null
  stay_until: string | null
  min_nights: number | null
  max_uses: number | null
  active: boolean
  featured: boolean
  uses: number
  created_at: string
}

export async function listCouponsRpc(pousadaId: string): Promise<Coupon[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_pousada_coupons', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  return ((data ?? []) as CouponRow[]).map((r) => ({
    id: r.id,
    code: r.code,
    kind: kindOf(r.kind),
    value: Number(r.value),
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    stayFrom: r.stay_from,
    stayUntil: r.stay_until,
    minNights: r.min_nights,
    maxUses: r.max_uses,
    active: r.active,
    featured: r.featured,
    uses: Number(r.uses),
    createdAt: r.created_at,
  }))
}

export type CouponWrite = {
  pousadaId: string
  code: string
  kind: CouponKind
  value: number
  validFrom: string | null
  validUntil: string | null
  stayFrom: string | null
  stayUntil: string | null
  minNights: number | null
  maxUses: number | null
}

export async function createCouponRpc(c: CouponWrite): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_pousada_coupon', {
    p_pousada_id: c.pousadaId,
    p_code: c.code,
    p_kind: c.kind,
    p_value: c.value,
    p_valid_from: orNull(c.validFrom),
    p_valid_until: orNull(c.validUntil),
    p_stay_from: orNull(c.stayFrom),
    p_stay_until: orNull(c.stayUntil),
    p_min_nights: orNull(c.minNights),
    p_max_uses: orNull(c.maxUses),
  })
  if (error) throw new Error(error.message)
  return { id: String(data) }
}

export async function setCouponActiveRpc(couponId: string, active: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_pousada_coupon_active', {
    p_coupon_id: couponId,
    p_active: active,
  })
  if (error) throw new Error(error.message)
}

export async function setCouponFeaturedRpc(couponId: string, featured: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_pousada_coupon_featured', {
    p_coupon_id: couponId,
    p_featured: featured,
  })
  if (error) throw new Error(error.message)
}

/** Cupom divulgado da pousada, se estiver valendo hoje. Público. */
export async function getFeaturedCouponRpc(slug: string): Promise<FeaturedCoupon | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_featured_coupon', { p_slug: slug })
  if (error) throw new Error(error.message)
  const row = (data ?? [])[0] as
    | {
        code: string
        kind: string
        value: number
        min_nights: number | null
        valid_until: string | null
        stay_from: string | null
        stay_until: string | null
      }
    | undefined
  if (!row) return null
  return {
    code: row.code,
    kind: kindOf(row.kind),
    value: Number(row.value),
    minNights: row.min_nights,
    validUntil: row.valid_until,
    stayFrom: row.stay_from,
    stayUntil: row.stay_until,
  }
}

/** Converte a resposta das RPCs de cupom (jsonb) num tipo fechado. */
export function toCouponRejection(raw: Record<string, unknown>): CouponRejection {
  switch (raw.reason) {
    case 'already_used':
    case 'staff':
    case 'too_many_attempts':
      return { reason: raw.reason }
    case 'min_nights':
      return { reason: 'min_nights', minNights: Number(raw.minNights) }
    case 'stay_period':
      return {
        reason: 'stay_period',
        stayFrom: typeof raw.stayFrom === 'string' ? raw.stayFrom : null,
        stayUntil: typeof raw.stayUntil === 'string' ? raw.stayUntil : null,
      }
    case 'min_value':
      return { reason: 'min_value', value: Number(raw.value) }
    case 'changed':
      return { reason: 'changed', discount: Number(raw.discount) }
    default:
      return { reason: 'invalid' }
  }
}

export async function previewCouponRpc(input: {
  roomId: string
  checkin: string
  checkout: string
  code: string
}): Promise<CouponPreview> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('preview_booking_coupon', {
    p_room_id: input.roomId,
    p_checkin: input.checkin,
    p_checkout: input.checkout,
    p_code: input.code,
  })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Record<string, unknown>
  if (raw.ok !== true) return { ok: false, ...toCouponRejection(raw) }
  return {
    ok: true,
    code: String(raw.code),
    kind: kindOf(raw.kind),
    value: Number(raw.value),
    subtotal: Number(raw.subtotal),
    discount: Number(raw.discount),
    total: Number(raw.total),
  }
}

export type CreateBookingWithCouponParams = {
  pousadaId: string
  roomId: string
  responsibleGuestId: string
  checkin: string
  checkout: string
  adults: number
  subtotal: number
  couponCode: string
  origin: 'rota_das_pousadas' | 'link_bio'
  expectedDiscount?: number
}

export type CreateBookingWithCouponResult =
  | { ok: true; id: string; code: string; discount: number; total: number }
  | ({ ok: false } & CouponRejection)

/**
 * Reserva pública com cupom numa transação só (0100): valida o cupom com
 * lock, cria a reserva por `create_booking` e grava desconto e uso.
 */
export async function createBookingWithCouponRpc(
  p: CreateBookingWithCouponParams,
): Promise<CreateBookingWithCouponResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_booking_with_coupon', {
    p_pousada_id: p.pousadaId,
    p_room_id: p.roomId,
    p_responsible_guest_id: p.responsibleGuestId,
    p_checkin: p.checkin,
    p_checkout: p.checkout,
    p_adults: p.adults,
    p_subtotal: p.subtotal,
    p_coupon_code: p.couponCode,
    p_origin: p.origin,
    p_expected_discount: orNull(p.expectedDiscount ?? null),
  })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Record<string, unknown>
  if (raw.ok !== true) return { ok: false, ...toCouponRejection(raw) }
  return {
    ok: true,
    id: String(raw.id),
    code: String(raw.code),
    discount: Number(raw.discount),
    total: Number(raw.total),
  }
}

/** Cupom usado na reserva, para o detalhe no painel (RLS: equipe da pousada). */
export async function getBookingCouponRedemption(
  bookingId: string,
): Promise<{ code: string; discount: number; released: boolean } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('booking_coupon_redemptions')
    .select('code, discount, released_at')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { code: data.code, discount: Number(data.discount), released: data.released_at !== null }
}
