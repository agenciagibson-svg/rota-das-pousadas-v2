import { describe, expect, it } from 'vitest'
import {
  campaignResults,
  diagnose,
  offerMessage,
  profileIssues,
  type GrowthProfile,
} from './growth'
import type { PousadaRow, ReportBooking } from './report-metrics'

const profile = (over: Partial<GrowthProfile> = {}): GrowthProfile => ({
  pousadaId: 'p',
  photos: 8,
  hasCover: true,
  descriptionLen: 400,
  hasMercadoPago: false,
  hasPix: true,
  activeRooms: 4,
  reviewsCount: 3,
  ownerName: 'Beto Silva',
  ownerEmail: null,
  whatsapp: null,
  phone: null,
  ...over,
})
const row = (over: Partial<PousadaRow> = {}): PousadaRow => ({
  id: 'p',
  slug: 'p',
  name: 'Pousada P',
  city: 'Monte Verde',
  state: 'MG',
  region: 'Sudeste',
  rooms: 4,
  volume: 0,
  volumePrev: 0,
  deltaPct: 0,
  bookings: 0,
  nights: 0,
  occupancy: 0,
  avgTicket: 0,
  cancelRate: 0,
  rating: null,
  reviews: 0,
  status: 'sem_resultado',
  ...over,
})

describe('plano de ação', () => {
  it('perfil incompleto vem antes do anúncio', () => {
    const issues = profileIssues(profile({ photos: 2, hasPix: false, descriptionLen: 50 }))
    expect(issues.filter((i) => i.blocks).map((i) => i.key)).toEqual(['fotos', 'pagamento'])
    const d = diagnose(row(), profile({ hasPix: false }), null)
    expect(d.recommendation).toBe('arrumar_perfil')
    expect(d.reason).toContain('sem pagamento online')
  })

  it('perfil pronto e sem vendas: oferecer tráfego, com prioridade maior se a pousada pediu', () => {
    const base = diagnose(row(), profile(), null)
    expect(base.recommendation).toBe('trafego')
    const asked = diagnose(row(), profile(), {
      pousadaId: 'p',
      stage: 'interessado',
      serviceFee: null,
      adBudget: null,
      nextContact: null,
      campaignStart: null,
      campaignEnd: null,
      ownerInterestAt: '2026-09-28T10:00:00Z',
      lostReason: '',
      updatedAt: null,
    })
    expect(asked.priority).toBeGreaterThan(base.priority)
    expect(
      diagnose(row({ status: 'crescendo', occupancy: 72, bookings: 9 }), profile(), null)
        .recommendation,
    ).toBe('acompanhar')
    expect(offerMessage('Beto Silva', 'Pousada P', base)).toContain('Olá, Beto!')
  })

  it('resultado da campanha compara a mesma janela antes e depois', () => {
    const B = (createdAt: string, total: number, checkin: string): ReportBooking => ({
      pousadaId: 'p',
      status: 'confirmed',
      origin: 'rota_das_pousadas',
      total,
      checkin,
      checkout: checkin.replace(/-(\d\d)$/, (_, d) => `-${String(Number(d) + 2).padStart(2, '0')}`),
      createdAt,
    })
    const bookings = [
      B('2026-07-20T10:00:00Z', 1000, '2026-07-25'), // antes
      B('2026-08-05T10:00:00Z', 1500, '2026-08-10'), // depois
      B('2026-08-20T10:00:00Z', 1500, '2026-08-22'), // depois
    ]
    const r = campaignResults({
      bookings,
      rooms: 2,
      start: '2026-08-01',
      end: null,
      today: '2026-09-15',
      serviceFee: 500,
      adBudget: 1000,
    })
    expect(r.elapsedDays).toBe(46)
    expect(r.checkpoints.map((c) => c.days)).toEqual([30, 46])
    const c30 = r.checkpoints[0]!
    expect(c30.before.volume).toBe(1000)
    expect(c30.after.volume).toBe(3000)
    expect(c30.volumeDeltaPct).toBe(200)
    expect(c30.investment).toBe(1500)
    expect(c30.returnMultiple).toBe(1.3)
  })
})
