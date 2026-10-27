import { formatISODate, formatPrice } from '@/lib/format'
import type { CouponKind, CouponRejection, FeaturedCoupon } from './types'

/**
 * Regras puras do cupom (0100). O valor que vale é SEMPRE o do banco
 * (`coupon_discount` na migration 0100); estas funções servem para mostrar
 * textos e para testar que as duas contas batem.
 */

/** Código: 3 a 20 letras ou números, sem acento, guardado em maiúsculas. */
export const COUPON_CODE_RE = /^[A-Z0-9]{3,20}$/

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/**
 * Desconto em reais inteiros (mesma convenção de bookings.total). Percentual
 * arredonda para o real mais próximo (meio real sobe), como as tarifas
 * percentuais da 0087, deixando pelo menos R$ 1 de total. Nunca passa do
 * subtotal nem fica negativo.
 */
export function couponDiscount(kind: CouponKind, value: number, subtotal: number): number {
  if (!(subtotal > 0) || !(value > 0)) return 0
  // Percentual deixa pelo menos R$ 1 de total (total zero trava Pix e Mercado
  // Pago); fixo só é aceito pelo banco quando é menor que o subtotal.
  const raw =
    kind === 'percent'
      ? Math.min(subtotal - 1, Math.floor((subtotal * value + 50) / 100))
      : Math.round(value)
  return Math.max(0, Math.min(subtotal, raw))
}

/** "10%" ou "R$ 50". */
export function couponValueLabel(kind: CouponKind, value: number): string {
  return kind === 'percent' ? `${value}%` : formatPrice(value)
}

/**
 * Condições do cupom em linguagem simples, só com o que está cadastrado —
 * nada de promessa que a Rota não consiga provar.
 */
export function couponConditions(
  coupon: Pick<
    FeaturedCoupon,
    'kind' | 'value' | 'minNights' | 'validUntil' | 'stayFrom' | 'stayUntil'
  >,
): string[] {
  const out: string[] = []
  if (coupon.minNights && coupon.minNights > 1)
    out.push(`Estadia mínima de ${coupon.minNights} noites`)
  if (coupon.stayFrom && coupon.stayUntil) {
    out.push(
      `Para estadias de ${formatISODate(coupon.stayFrom)} a ${formatISODate(coupon.stayUntil)}`,
    )
  } else if (coupon.stayFrom) {
    out.push(`Para estadias a partir de ${formatISODate(coupon.stayFrom)}`)
  } else if (coupon.stayUntil) {
    out.push(`Para estadias até ${formatISODate(coupon.stayUntil)}`)
  }
  if (coupon.kind === 'fixed') out.push(`Para estadias acima de ${formatPrice(coupon.value)}`)
  if (coupon.validUntil) out.push(`Válido até ${formatISODate(coupon.validUntil)}`)
  out.push('Uma vez por hóspede')
  return out
}

/** Mensagem para o hóspede quando o cupom não vale. */
export function couponRejectionMessage(rejection: CouponRejection): string {
  switch (rejection.reason) {
    case 'already_used':
      return 'Você já usou este cupom em outra reserva.'
    case 'min_nights':
      return `Este cupom vale para estadias de pelo menos ${rejection.minNights} noites.`
    case 'stay_period': {
      const { stayFrom, stayUntil } = rejection
      if (stayFrom && stayUntil)
        return `Este cupom vale para estadias entre ${formatISODate(stayFrom)} e ${formatISODate(stayUntil)}.`
      if (stayFrom) return `Este cupom vale para estadias a partir de ${formatISODate(stayFrom)}.`
      return `Este cupom vale para estadias até ${formatISODate(stayUntil)}.`
    }
    case 'min_value':
      return `Este cupom vale para estadias acima de ${formatPrice(rejection.value)}.`
    case 'staff':
      return 'Cupom é para hóspedes reservando pelo site. Pela equipe, use o campo de desconto da reserva.'
    case 'too_many_attempts':
      return 'Muitas tentativas de cupom. Tente de novo daqui a 1 hora.'
    case 'changed':
      return `O desconto deste cupom agora é de ${formatPrice(rejection.discount)}. Confira e confirme de novo.`
    default:
      return 'Cupom inválido ou indisponível.'
  }
}
