/** Cupom da pousada para quem reserva direto (0100). Valores em reais inteiros. */
export type CouponKind = 'percent' | 'fixed'

export type Coupon = {
  id: string
  code: string
  kind: CouponKind
  /** 1–90 (percentual) ou reais (valor fixo). */
  value: number
  /** Período em que o cupom pode ser usado (datas ISO, pontas inclusivas). */
  validFrom: string | null
  validUntil: string | null
  /** "Só para estadias entre": entrada a partir de, saída até. */
  stayFrom: string | null
  stayUntil: string | null
  minNights: number | null
  maxUses: number | null
  active: boolean
  /** O cupom divulgado na bio e na página pública (no máximo um). */
  featured: boolean
  /** Usos em reservas não canceladas. */
  uses: number
  createdAt: string
}

/** O que a bio e a página pública mostram do cupom divulgado. */
export type FeaturedCoupon = {
  code: string
  kind: CouponKind
  value: number
  minNights: number | null
  validUntil: string | null
  stayFrom: string | null
  stayUntil: string | null
}

/**
 * Por que o cupom não vale. `invalid` cobre "não existe", pausado, fora do
 * período de uso e esgotado — de propósito a mesma resposta (0100).
 */
export type CouponRejection =
  | { reason: 'invalid' }
  | { reason: 'already_used' }
  | { reason: 'min_nights'; minNights: number }
  | { reason: 'stay_period'; stayFrom: string | null; stayUntil: string | null }
  | { reason: 'min_value'; value: number }
  | { reason: 'staff' }
  | { reason: 'too_many_attempts' }
  | { reason: 'changed'; discount: number }

export type CouponPreview =
  | {
      ok: true
      code: string
      kind: CouponKind
      value: number
      subtotal: number
      discount: number
      total: number
    }
  | ({ ok: false } & CouponRejection)
