import 'server-only'
import { requireCapability } from '@/lib/auth/require-capability'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import {
  createCouponRpc,
  getBookingCouponRedemption,
  getFeaturedCouponRpc,
  listCouponsRpc,
  previewCouponRpc,
  setCouponActiveRpc,
  setCouponFeaturedRpc,
} from '@/repositories/coupons.repository'
import type { Coupon, CouponPreview, FeaturedCoupon } from '../types'
import type { CreateCouponData } from '../schemas'

/**
 * Cupons da pousada (0100). Primeira barreira: `coupon:manage` (dono e
 * gestor) na pousada ATIVA; a segunda é `auth_can_manage_pousada` dentro das
 * RPCs. O desconto da reserva nunca é calculado aqui — só no banco.
 */
export async function listCoupons(): Promise<Coupon[]> {
  const { pousadaId } = await requireCapability('coupon:manage')
  return listCouponsRpc(pousadaId)
}

export async function addCoupon(input: CreateCouponData): Promise<{ id: string }> {
  const { pousadaId } = await requireCapability('coupon:manage')
  return createCouponRpc({
    pousadaId,
    code: input.code,
    kind: input.kind,
    value: input.value,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    stayFrom: input.stayFrom ?? null,
    stayUntil: input.stayUntil ?? null,
    minNights: input.minNights ?? null,
    maxUses: input.maxUses ?? null,
  })
}

/** O cupom precisa ser da pousada ativa: a RPC confere (devolve "não encontrado"). */
export async function setCouponActive(id: string, active: boolean): Promise<void> {
  await requireCapability('coupon:manage')
  await setCouponActiveRpc(id, active)
}

export async function setCouponFeatured(id: string, featured: boolean): Promise<void> {
  await requireCapability('coupon:manage')
  await setCouponFeaturedRpc(id, featured)
}

/**
 * Cupom divulgado (bio e página pública). Falha aqui não pode derrubar a
 * página: sem cupom, simplesmente não aparece nada.
 */
export async function getFeaturedCoupon(slug: string): Promise<FeaturedCoupon | null> {
  try {
    return await getFeaturedCouponRpc(slug)
  } catch (error) {
    console.error('[cupons] falha ao ler o cupom divulgado', error)
    return null
  }
}

/** Prévia do desconto para o hóspede logado (a reserva já exige login). */
export async function previewCoupon(input: {
  roomId: string
  checkin: string
  checkout: string
  code: string
}): Promise<CouponPreview> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para usar um cupom.')
  if (!input.code) return { ok: false, reason: 'invalid' }
  return previewCouponRpc(input)
}

/**
 * Cupom usado numa reserva, para o detalhe no painel. Quem chama já conferiu
 * a reserva na pousada ativa (`getOwnerReservationDetail`); a RLS de
 * `booking_coupon_redemptions` repete a regra de leitura de `bookings`.
 */
export async function getBookingCouponForStaff(
  bookingId: string,
): Promise<{ code: string; discount: number; released: boolean } | null> {
  return getBookingCouponRedemption(bookingId)
}
