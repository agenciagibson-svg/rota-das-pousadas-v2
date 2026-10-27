import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMyBookingCalendarFile,
  getSharedTrip,
  revokeMyBookingShare,
  shareMyBooking,
} from './booking-share.service'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMyBookingTrip: vi.fn(),
  shareMyBookingRpc: vi.fn(),
  revokeMyBookingShareRpc: vi.fn(),
  getSharedBookingRpc: vi.fn(),
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/booking-share.repository', () => ({
  getMyBookingTrip: mocks.getMyBookingTrip,
  shareMyBookingRpc: mocks.shareMyBookingRpc,
  revokeMyBookingShareRpc: mocks.revokeMyBookingShareRpc,
  getSharedBookingRpc: mocks.getSharedBookingRpc,
}))
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => true,
  publicEnv: { siteUrl: 'https://rota.example.test' },
}))

// Dados sintéticos.
const BOOKING = '30000000-0000-4000-8000-000000000941'
const trip = {
  id: BOOKING,
  code: 'RP-ABC123',
  status: 'confirmed',
  paymentDueAt: null,
  checkin: '2026-11-14',
  checkout: '2026-11-17',
  pousadaName: 'Pousada Teste',
  address: 'Rua das Flores, 10',
  cep: '36325-000',
  city: 'Tiradentes',
  state: 'MG',
  checkinTime: '15:00',
  checkoutTime: '11:00',
  timeZone: 'America/Sao_Paulo',
}
const NOW = new Date('2026-10-26T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  mocks.getMyBookingTrip.mockResolvedValue(trip)
})

describe('agenda (.ics)', () => {
  it('sem login não gera nada', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect(await getMyBookingCalendarFile(BOOKING, NOW)).toBeNull()
    expect(mocks.getMyBookingTrip).not.toHaveBeenCalled()
  })

  it('reserva de outra pessoa (o banco não devolve) = null', async () => {
    mocks.getMyBookingTrip.mockResolvedValue(null)
    expect(await getMyBookingCalendarFile(BOOKING, NOW)).toBeNull()
  })

  it('gera o arquivo com nome, código e UID do site', async () => {
    const file = await getMyBookingCalendarFile(BOOKING, NOW)
    expect(file?.fileName).toBe('reserva-RP-ABC123.ics')
    expect(file?.content).toContain(`UID:reserva-${BOOKING}@rota.example.test`)
    expect(file?.content).toContain('STATUS:CONFIRMED')
    expect(file?.content).toContain('Código da reserva: RP-ABC123')
  })

  it('pendente = provisório; pendência vencida = cancelado', async () => {
    mocks.getMyBookingTrip.mockResolvedValue({
      ...trip,
      status: 'pending',
      paymentDueAt: '2026-10-27T12:00:00Z',
    })
    expect((await getMyBookingCalendarFile(BOOKING, NOW))?.content).toContain('STATUS:TENTATIVE')
    mocks.getMyBookingTrip.mockResolvedValue({
      ...trip,
      status: 'pending',
      paymentDueAt: '2026-10-25T12:00:00Z',
    })
    expect((await getMyBookingCalendarFile(BOOKING, NOW))?.content).toContain('STATUS:CANCELLED')
  })
})

describe('link para o acompanhante', () => {
  it('monta a URL pública com o token do banco', async () => {
    mocks.shareMyBookingRpc.mockResolvedValue('t'.repeat(43))
    expect(await shareMyBooking(BOOKING, false)).toEqual({
      url: `https://rota.example.test/viagem/${'t'.repeat(43)}`,
    })
    expect(mocks.shareMyBookingRpc).toHaveBeenCalledWith(BOOKING, false)
  })

  it('sem login não cria nem revoga', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    await expect(shareMyBooking(BOOKING, true)).rejects.toThrow('Faça login')
    await expect(revokeMyBookingShare(BOOKING)).rejects.toThrow('Faça login')
    expect(mocks.shareMyBookingRpc).not.toHaveBeenCalled()
    expect(mocks.revokeMyBookingShareRpc).not.toHaveBeenCalled()
  })

  it('token fora do formato nem consulta o banco', async () => {
    expect(await getSharedTrip('../etc')).toBeNull()
    expect(mocks.getSharedBookingRpc).not.toHaveBeenCalled()
  })

  it('lê a viagem pública só com os campos permitidos', async () => {
    mocks.getSharedBookingRpc.mockResolvedValue({ status: 'cancelled', total: 999 })
    expect(await getSharedTrip('a'.repeat(43))).toEqual({ status: 'cancelled' })
    mocks.getSharedBookingRpc.mockResolvedValue(null)
    expect(await getSharedTrip('a'.repeat(43))).toBeNull()
  })
})
