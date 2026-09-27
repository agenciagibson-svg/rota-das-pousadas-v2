import { describe, expect, it } from 'vitest'
import { buildHeaderSummary } from './header-summary'
import type { SessionUser } from './types'
import type { Booking } from '@/features/reservas/types'

const now = new Date('2026-09-27T12:00:00.000Z')
const user: SessionUser = {
  id: 'u1',
  email: 'marcos@example.test',
  name: 'Marcos Menezes',
  platformRole: null,
  memberships: [],
}
const booking = (over: Partial<Booking>): Booking =>
  ({
    id: 'b',
    code: 'RP-1',
    pousadaSlug: 'refugio',
    pousadaName: 'Refúgio',
    pousadaImage: '',
    roomName: 'Quarto',
    city: '',
    state: '',
    checkin: '2026-10-10',
    checkout: '2026-10-12',
    guests: 2,
    nights: 2,
    subtotal: 1440,
    fee: 0,
    discount: 0,
    surcharge: 0,
    total: 1440,
    balanceDue: 1440,
    status: 'pending',
    paymentDueAt: '2026-09-27T14:00:00.000Z',
    cancellationReason: null,
    createdAt: '2026-09-27T12:00:00.000Z',
    ...over,
  }) as Booking

describe('resumo do cabeçalho', () => {
  it('deslogado', () => {
    expect(buildHeaderSummary(null, [], now)).toEqual({ user: null })
  })

  it('nome, iniciais e papéis', () => {
    const s = buildHeaderSummary(
      {
        ...user,
        platformRole: 'master' as SessionUser['platformRole'],
        memberships: [
          {
            id: 'm',
            pousadaId: 'p',
            role: 'proprietario' as never,
            status: 'active',
            suspendedReason: null,
          },
        ],
      },
      [],
      now,
    )
    if (!s.user) throw new Error('esperava usuário')
    expect(s.user.firstName).toBe('Marcos')
    expect(s.user.initials).toBe('MM')
    expect(s.user.hasPousadaAccess).toBe(true)
    expect(s.user.isPlatformStaff).toBe(true)
  })

  it('sem nome, usa o e-mail', () => {
    const s = buildHeaderSummary({ ...user, name: '' }, [], now)
    if (!s.user) throw new Error()
    expect(s.user.firstName).toBe('marcos')
    expect(s.user.initials).toBe('M')
  })

  it('só pendentes dentro do prazo, mais urgente primeiro; próxima estadia confirmada', () => {
    const s = buildHeaderSummary(
      user,
      [
        booking({ id: 'late', paymentDueAt: '2026-09-27T20:00:00.000Z' }),
        booking({ id: 'soon', paymentDueAt: '2026-09-27T13:00:00.000Z' }),
        booking({ id: 'expired', paymentDueAt: '2026-09-27T11:00:00.000Z' }),
        booking({ id: 'cancel', status: 'cancelled' }),
        booking({ id: 'conf', status: 'confirmed', checkin: '2026-11-01', checkout: '2026-11-03' }),
        booking({ id: 'past', status: 'confirmed', checkin: '2026-09-01', checkout: '2026-09-03' }),
      ],
      now,
    )
    if (!s.user) throw new Error()
    expect(s.pendingTrips.map((t) => t.id)).toEqual(['soon', 'late'])
    expect(s.nextTrip?.id).toBe('conf')
  })
})
