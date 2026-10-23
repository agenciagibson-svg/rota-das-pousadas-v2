import { describe, expect, it } from 'vitest'
import { buildNotices, noticeBadgeCount, type NoticeSources } from './notices'

const vazio: NoticeSources = {
  proofsToReview: 0,
  paymentReviews: 0,
  pendingBookings: 0,
  arrivalsToday: 0,
  arrivalsWithoutPrecheckin: 0,
  newOrders: 0,
  lowStock: 0,
  channelErrors: 0,
  setupMissing: 0,
}

describe('avisos do sino', () => {
  it('sem nada pendente o sino não acende', () => {
    const notices = buildNotices(vazio)
    expect(notices).toEqual([])
    expect(noticeBadgeCount(notices)).toBe(0)
  })

  it('fonte nula (papel sem acesso ou falha) não gera aviso', () => {
    expect(buildNotices({ ...vazio, proofsToReview: null, newOrders: null })).toEqual([])
  })

  it('urgentes primeiro, informativos por último e fora da contagem', () => {
    const notices = buildNotices({
      ...vazio,
      pendingBookings: 2,
      proofsToReview: 1,
      channelErrors: 1,
      setupMissing: 3,
    })
    expect(notices.map((n) => n.id)).toEqual(['channel-errors', 'proofs', 'pending', 'setup'])
    expect(noticeBadgeCount(notices)).toBe(2)
  })

  it('texto no singular e no plural', () => {
    expect(buildNotices({ ...vazio, proofsToReview: 1 })[0].title).toBe(
      '1 comprovante Pix para aprovar',
    )
    expect(buildNotices({ ...vazio, newOrders: 3 })[0].title).toBe(
      '3 pedidos novos do app da estadia',
    )
    expect(buildNotices({ ...vazio, setupMissing: 1 })[0].title).toBe(
      'Configuração da pousada: falta 1 passo',
    )
  })
})
