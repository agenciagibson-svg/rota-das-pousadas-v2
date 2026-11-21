import { describe, expect, it } from 'vitest'
import { couponFromQuery, inOfferSendWindow, offerHref } from './rules'
import { sendOfferSchema } from './schemas'
import { offerEmail } from '@/lib/email/offer-email'
import { offerCard } from '@/features/app-fases/phase'

const brt = (time: string) => new Date(`2026-12-10T${time}:00-03:00`)

describe('janela de envio das ofertas (Brasília)', () => {
  it('das 8h às 21h, nada de madrugada nem de noite', () => {
    expect(inOfferSendWindow(brt('07:59'))).toBe(false)
    expect(inOfferSendWindow(brt('08:00'))).toBe(true)
    expect(inOfferSendWindow(brt('20:59'))).toBe(true)
    expect(inOfferSendWindow(brt('21:00'))).toBe(false)
    expect(inOfferSendWindow(brt('03:00'))).toBe(false)
  })
})

describe('cupom no link', () => {
  it('aceita só o formato de cupom', () => {
    expect(couponFromQuery(' volta1a2b3 ')).toBe('VOLTA1A2B3')
    expect(couponFromQuery('<script>')).toBeNull()
    expect(couponFromQuery(['A', 'B'])).toBeNull()
    expect(couponFromQuery(undefined)).toBeNull()
  })

  it('link da oferta leva à pousada com o cupom', () => {
    expect(offerHref('pousada-ipe', 'VOLTAABC123')).toBe('/pousada/pousada-ipe?cupom=VOLTAABC123')
  })
})

describe('nova oferta (painel)', () => {
  const ok = { percent: 15, validDays: 30, stayFrom: '', stayUntil: '', message: '' }
  it('aceita o padrão', () => {
    const r = sendOfferSchema.safeParse(ok)
    expect(r.success && r.data).toMatchObject({ percent: 15, validDays: 30, stayFrom: undefined })
  })
  it('limites de desconto, validade e período', () => {
    expect(sendOfferSchema.safeParse({ ...ok, percent: 60 }).success).toBe(false)
    expect(sendOfferSchema.safeParse({ ...ok, percent: 4 }).success).toBe(false)
    expect(sendOfferSchema.safeParse({ ...ok, validDays: 3 }).success).toBe(false)
    expect(
      sendOfferSchema.safeParse({ ...ok, stayFrom: '2027-01-10', stayUntil: '2027-01-05' }).success,
    ).toBe(false)
    expect(sendOfferSchema.safeParse({ ...ok, message: 'x'.repeat(201) }).success).toBe(false)
  })
})

const target = {
  deliveryId: 'd-1',
  email: 'ana@example.test',
  guestName: 'Ana',
  pousadaName: 'Pousada <Ipê>',
  pousadaSlug: 'pousada-ipe',
  code: 'VOLTAABC123',
  percent: 15,
  validUntil: '2027-01-09',
  stayFrom: '2027-01-02',
  stayUntil: '2027-02-28',
  message: 'Volte no <b>verão</b>',
}

describe('e-mail da oferta', () => {
  it('assunto, cupom, validade, período e link já com o cupom', () => {
    const e = offerEmail(target)
    expect(e.subject).toBe('15% de desconto para voltar na Pousada <Ipê>')
    expect(e.html).toContain('VOLTAABC123')
    expect(e.html).toContain('09/01/2027')
    expect(e.html).toContain('/pousada/pousada-ipe?cupom=VOLTAABC123')
    expect(e.text).toContain('entre 02/01/2027 e 28/02/2027')
  })

  it('texto da pousada escapado e link para parar de receber', () => {
    const e = offerEmail(target)
    expect(e.html).not.toContain('<b>verão</b>')
    expect(e.html).toContain('&lt;b&gt;verão&lt;/b&gt;')
    expect(e.html).not.toContain('Pousada <Ipê>')
    expect(e.html).toContain('/conta/ofertas')
    expect(e.text).toContain('Parar de receber ofertas')
  })
})

describe('cartão da oferta na loja', () => {
  it('a primeira oferta, dispensável', () => {
    expect(offerCard([])).toBeNull()
    expect(offerCard([{ ...target, deliveryId: 'd-1' }])).toEqual({
      kind: 'oferta',
      eyebrow: 'Oferta para você · 15% até 09/01',
      title: 'Pousada <Ipê>',
      cta: 'Ver datas com desconto',
      href: '/pousada/pousada-ipe?cupom=VOLTAABC123',
      dismissKey: 'rp_oferta_d-1',
    })
  })
})
