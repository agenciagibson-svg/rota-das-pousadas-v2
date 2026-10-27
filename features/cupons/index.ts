/**
 * Cupons da pousada para quem reserva direto (0100): gestão no painel
 * (Marketing), campo "Tenho um cupom" na reserva pelo site e a faixa do cupom
 * divulgado na bio e na página pública. O desconto é sempre do banco.
 */
export type { Coupon, CouponKind, CouponPreview, CouponRejection, FeaturedCoupon } from './types'
export {
  COUPON_CODE_RE,
  couponConditions,
  couponDiscount,
  couponRejectionMessage,
  couponValueLabel,
  normalizeCouponCode,
} from './discount'
export {
  couponFromParam,
  couponToggleSchema,
  createCouponSchema,
  previewCouponSchema,
  type CreateCouponInput,
} from './schemas'
