'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { couponToggleSchema, createCouponSchema, previewCouponSchema } from './schemas'
import {
  addCoupon,
  previewCoupon,
  setCouponActive,
  setCouponFeatured,
} from './services/coupons.service'

/** O cupom divulgado aparece na bio (`/<slug>`) e na página da pousada. */
function revalidateCoupons() {
  revalidatePath('/dashboard/marketing')
}

export const createCouponAction = createAction(createCouponSchema, async (input) => {
  const result = await addCoupon(input)
  revalidateCoupons()
  return result
})

export const setCouponActiveAction = createAction(couponToggleSchema, async (input) => {
  await setCouponActive(input.id, input.on)
  revalidateCoupons()
  return { ok: true as const }
})

export const setCouponFeaturedAction = createAction(couponToggleSchema, async (input) => {
  await setCouponFeatured(input.id, input.on)
  revalidateCoupons()
  return { ok: true as const }
})

export const previewCouponAction = createAction(previewCouponSchema, async (input) =>
  previewCoupon(input),
)
