import { describe, expect, it } from 'vitest'
import {
  couponConditions,
  couponDiscount,
  couponRejectionMessage,
  couponValueLabel,
  normalizeCouponCode,
} from './discount'
import { couponFromParam, createCouponSchema, previewCouponSchema } from './schemas'
import { toCouponRejection } from '@/repositories/coupons.repository'

describe('couponDiscount — mesma conta do banco (coupon_discount, 0100)', () => {
  // Valores conferidos também em supabase/tests/cupons-0100.sql.
  it.each([
    ['percent', 10, 1000, 100],
    ['percent', 15, 333, 50], // 49,95 → 50 (meio real sobe)
    ['percent', 10, 5, 1], // 0,5 → 1
    ['percent', 10, 4, 0], // 0,4 → 0
    ['percent', 20, 1500, 300],
    ['percent', 90, 1, 0], // deixa R$ 1 de total
    ['percent', 90, 5, 4], // 4,5 → 5, mas o total fica em R$ 1
    ['fixed', 50, 300, 50],
    ['fixed', 1000, 300, 300], // nunca passa do subtotal
    ['percent', 90, 0, 0],
    ['fixed', 50, -10, 0],
  ] as const)('%s %d sobre %d = %d', (kind, value, subtotal, expected) => {
    expect(couponDiscount(kind, value, subtotal)).toBe(expected)
  })

  it('valores em reais inteiros: o total nunca fica negativo', () => {
    for (let subtotal = 0; subtotal <= 2000; subtotal += 37) {
      for (const value of [1, 10, 33, 90]) {
        const d = couponDiscount('percent', value, subtotal)
        expect(Number.isInteger(d)).toBe(true)
        expect(subtotal - d).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('textos do cupom', () => {
  it('rótulo do valor', () => {
    expect(couponValueLabel('percent', 10)).toBe('10%')
    expect(couponValueLabel('fixed', 50)).toBe('R$ 50')
  })

  it('condições vêm só do que está cadastrado', () => {
    expect(
      couponConditions({
        kind: 'percent',
        value: 10,
        minNights: null,
        validUntil: null,
        stayFrom: null,
        stayUntil: null,
      }),
    ).toEqual(['Uma vez por hóspede'])
    expect(
      couponConditions({
        kind: 'fixed',
        value: 50,
        minNights: 3,
        validUntil: '2096-12-31',
        stayFrom: '2096-01-01',
        stayUntil: '2096-02-01',
      }),
    ).toEqual([
      'Estadia mínima de 3 noites',
      'Para estadias de 01/01/2096 a 01/02/2096',
      'Para estadias acima de R$ 50',
      'Válido até 31/12/2096',
      'Uma vez por hóspede',
    ])
  })

  it('cupom inválido, pausado, vencido e esgotado têm a mesma mensagem', () => {
    expect(couponRejectionMessage({ reason: 'invalid' })).toBe('Cupom inválido ou indisponível.')
    expect(couponRejectionMessage(toCouponRejection({ reason: 'algo-desconhecido' }))).toBe(
      'Cupom inválido ou indisponível.',
    )
  })

  it('motivos que só quem sabe o código vê explicam o que fazer', () => {
    expect(couponRejectionMessage({ reason: 'min_nights', minNights: 3 })).toBe(
      'Este cupom vale para estadias de pelo menos 3 noites.',
    )
    expect(
      couponRejectionMessage({ reason: 'stay_period', stayFrom: '2096-01-01', stayUntil: null }),
    ).toBe('Este cupom vale para estadias a partir de 01/01/2096.')
    expect(couponRejectionMessage({ reason: 'changed', discount: 60 })).toContain('R$ 60')
    expect(couponRejectionMessage({ reason: 'too_many_attempts' })).toContain('1 hora')
  })
})

describe('toCouponRejection — resposta do banco', () => {
  it('converte os campos de cada motivo', () => {
    expect(toCouponRejection({ ok: false, reason: 'min_nights', minNights: 4 })).toEqual({
      reason: 'min_nights',
      minNights: 4,
    })
    expect(toCouponRejection({ ok: false, reason: 'stay_period', stayFrom: '2096-01-01' })).toEqual(
      { reason: 'stay_period', stayFrom: '2096-01-01', stayUntil: null },
    )
    expect(toCouponRejection({ ok: false, reason: 'changed', discount: 100 })).toEqual({
      reason: 'changed',
      discount: 100,
    })
  })
})

describe('schemas', () => {
  it('normaliza o código', () => {
    expect(normalizeCouponCode('  direto10 ')).toBe('DIRETO10')
    expect(createCouponSchema.parse({ code: ' direto10', kind: 'percent', value: 10 }).code).toBe(
      'DIRETO10',
    )
  })

  it('recusa código fora do formato e percentual acima de 90', () => {
    expect(createCouponSchema.safeParse({ code: 'AB', kind: 'percent', value: 10 }).success).toBe(
      false,
    )
    expect(
      createCouponSchema.safeParse({ code: 'COM ESPACO', kind: 'percent', value: 10 }).success,
    ).toBe(false)
    expect(
      createCouponSchema.safeParse({ code: 'MUITO', kind: 'percent', value: 95 }).success,
    ).toBe(false)
    expect(createCouponSchema.safeParse({ code: 'FIXO', kind: 'fixed', value: 95 }).success).toBe(
      true,
    )
  })

  it('datas em branco viram "sem limite"; períodos invertidos são recusados', () => {
    const parsed = createCouponSchema.parse({
      code: 'DATAS',
      kind: 'percent',
      value: 10,
      validFrom: '',
      validUntil: '',
    })
    expect(parsed.validFrom).toBeUndefined()
    expect(
      createCouponSchema.safeParse({
        code: 'DATAS',
        kind: 'percent',
        value: 10,
        stayFrom: '2096-02-01',
        stayUntil: '2096-01-01',
      }).success,
    ).toBe(false)
  })

  it('?cupom= da URL só aceita formato de código', () => {
    expect(couponFromParam('direto10')).toBe('DIRETO10')
    expect(couponFromParam('<script>')).toBeUndefined()
    expect(couponFromParam(undefined)).toBeUndefined()
  })

  it('prévia exige acomodação e datas em ordem', () => {
    const roomId = '20000000-0000-4000-8000-000000000001'
    expect(
      previewCouponSchema.safeParse({
        roomId,
        checkin: '2096-03-12',
        checkout: '2096-03-10',
        code: 'X',
      }).success,
    ).toBe(false)
    expect(
      previewCouponSchema.parse({
        roomId,
        checkin: '2096-03-10',
        checkout: '2096-03-12',
        code: ' ab12 ',
      }).code,
    ).toBe('AB12')
  })
})
