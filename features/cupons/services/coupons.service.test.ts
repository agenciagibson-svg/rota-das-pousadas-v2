import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  getCurrentUser: vi.fn(),
  createCouponRpc: vi.fn(),
  listCouponsRpc: vi.fn(),
  previewCouponRpc: vi.fn(),
  setCouponActiveRpc: vi.fn(),
  setCouponFeaturedRpc: vi.fn(),
  getFeaturedCouponRpc: vi.fn(),
  getBookingCouponRedemption: vi.fn(),
}))
vi.mock('@/lib/auth/require-capability', () => ({ requireCapability: mocks.requireCapability }))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/coupons.repository', () => ({
  createCouponRpc: mocks.createCouponRpc,
  listCouponsRpc: mocks.listCouponsRpc,
  previewCouponRpc: mocks.previewCouponRpc,
  setCouponActiveRpc: mocks.setCouponActiveRpc,
  setCouponFeaturedRpc: mocks.setCouponFeaturedRpc,
  getFeaturedCouponRpc: mocks.getFeaturedCouponRpc,
  getBookingCouponRedemption: mocks.getBookingCouponRedemption,
}))

import {
  addCoupon,
  getFeaturedCoupon,
  listCoupons,
  previewCoupon,
  setCouponActive,
  setCouponFeatured,
} from './coupons.service'
import { createCouponSchema } from '../schemas'

const POUSADA = '10000000-0000-4000-8000-000000000001'
const COUPON = '50000000-0000-4000-8000-000000000001'

describe('coupons.service — gestão no painel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireCapability.mockResolvedValue({ pousadaId: POUSADA, role: 'proprietario' })
    mocks.createCouponRpc.mockResolvedValue({ id: COUPON })
  })

  it('exige coupon:manage e usa a pousada ATIVA (nunca uma vinda do formulário)', async () => {
    await addCoupon(createCouponSchema.parse({ code: 'direto10', kind: 'percent', value: 10 }))
    expect(mocks.requireCapability).toHaveBeenCalledWith('coupon:manage')
    expect(mocks.createCouponRpc).toHaveBeenCalledWith({
      pousadaId: POUSADA,
      code: 'DIRETO10',
      kind: 'percent',
      value: 10,
      validFrom: null,
      validUntil: null,
      stayFrom: null,
      stayUntil: null,
      minNights: null,
      maxUses: null,
    })
  })

  it('sem permissão, nada chega ao banco', async () => {
    mocks.requireCapability.mockRejectedValue(new Error('Você não tem permissão para esta ação.'))
    await expect(listCoupons()).rejects.toThrow('permissão')
    await expect(setCouponActive(COUPON, false)).rejects.toThrow('permissão')
    await expect(setCouponFeatured(COUPON, true)).rejects.toThrow('permissão')
    expect(mocks.listCouponsRpc).not.toHaveBeenCalled()
    expect(mocks.setCouponActiveRpc).not.toHaveBeenCalled()
    expect(mocks.setCouponFeaturedRpc).not.toHaveBeenCalled()
  })

  it('pausar e divulgar repassam o id para a RPC (que confere a pousada)', async () => {
    await setCouponActive(COUPON, false)
    await setCouponFeatured(COUPON, true)
    expect(mocks.setCouponActiveRpc).toHaveBeenCalledWith(COUPON, false)
    expect(mocks.setCouponFeaturedRpc).toHaveBeenCalledWith(COUPON, true)
  })
})

describe('coupons.service — hóspede e páginas públicas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prévia exige login', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    await expect(
      previewCoupon({ roomId: 'r', checkin: '2096-03-10', checkout: '2096-03-12', code: 'X1Y' }),
    ).rejects.toThrow('Faça login')
    expect(mocks.previewCouponRpc).not.toHaveBeenCalled()
  })

  it('prévia devolve o que o banco calculou', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    const preview = {
      ok: true,
      code: 'DIRETO10',
      kind: 'percent',
      value: 10,
      subtotal: 1000,
      discount: 100,
      total: 900,
    }
    mocks.previewCouponRpc.mockResolvedValue(preview)
    const input = { roomId: 'r', checkin: '2096-03-10', checkout: '2096-03-12', code: 'DIRETO10' }
    await expect(previewCoupon(input)).resolves.toEqual(preview)
    expect(mocks.previewCouponRpc).toHaveBeenCalledWith(input)
  })

  it('falha ao ler o cupom divulgado não derruba a bio', async () => {
    mocks.getFeaturedCouponRpc.mockRejectedValue(new Error('fora do ar'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getFeaturedCoupon('pousada-teste')).resolves.toBeNull()
    spy.mockRestore()
  })
})
