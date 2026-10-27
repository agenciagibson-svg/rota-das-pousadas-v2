import { beforeEach, describe, expect, it, vi } from 'vitest'

// Dados sintéticos: pousada "p1", conta "u1".
const m = vi.hoisted(() => ({
  role: 'proprietario' as string | null,
  user: { id: 'u1' } as { id: string } | null,
  pousada: { id: 'p1', slug: 'p', name: 'P', status: 'publicada', roomId: '', timezone: '' } as {
    id: string
  } | null,
  settings: {
    address: 'Rua das Acácias, 100',
    cep: '37418-000',
    city: 'São Tomé das Letras',
    state: 'MG',
  },
  geocode: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/tenant-context', () => ({ getActiveTenantRole: async () => m.role }))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: async () => m.user }))
vi.mock('@/lib/audit/log', () => ({ logAudit: m.audit }))
vi.mock('@/lib/geo/nominatim', () => ({ geocodeAddress: m.geocode }))
vi.mock('@/repositories/management.repository', () => ({
  getPousadaSettings: async () => m.settings,
  updatePousadaLocation: m.update,
}))
vi.mock('./pms.service', () => ({ getOwnerPousada: async () => m.pousada }))

import { geocodeOwnerPousadaAddress, updateOwnerPousadaLocation } from './location.service'

beforeEach(() => {
  m.role = 'proprietario'
  m.user = { id: 'u1' }
  m.pousada = { id: 'p1' }
  m.geocode.mockReset()
  m.update.mockReset()
  m.audit.mockReset()
})

describe('updateOwnerPousadaLocation', () => {
  it('proprietário e gestor gravam o ponto arredondado e auditado', async () => {
    for (const role of ['proprietario', 'admin_pousada']) {
      m.role = role
      m.update.mockReset()
      const saved = await updateOwnerPousadaLocation({ lat: -21.12345678, lng: -44.98765432 })
      expect(saved).toEqual({ lat: -21.123457, lng: -44.987654 })
      expect(m.update).toHaveBeenCalledWith('p1', { lat: -21.123457, lng: -44.987654 })
    }
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pousada.location_updated', targetId: 'p1' }),
    )
  })

  it('null apaga o ponto', async () => {
    expect(await updateOwnerPousadaLocation(null)).toBeNull()
    expect(m.update).toHaveBeenCalledWith('p1', null)
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pousada.location_removed' }),
    )
  })

  it('recepção, governança e financeiro não mexem no ponto', async () => {
    for (const role of ['recepcionista', 'governanca', 'financeiro_pousada']) {
      m.role = role
      await expect(updateOwnerPousadaLocation({ lat: -21, lng: -44 })).rejects.toThrow('permissão')
    }
    expect(m.update).not.toHaveBeenCalled()
  })

  it('sem pousada ativa ou sem login, nada é gravado', async () => {
    m.pousada = null
    await expect(updateOwnerPousadaLocation({ lat: -21, lng: -44 })).rejects.toThrow()
    m.pousada = { id: 'p1' }
    m.user = null
    await expect(updateOwnerPousadaLocation({ lat: -21, lng: -44 })).rejects.toThrow()
    expect(m.update).not.toHaveBeenCalled()
  })

  it('segunda barreira: ponto fora do Brasil é recusado mesmo sem passar pelo schema', async () => {
    await expect(updateOwnerPousadaLocation({ lat: 38.72, lng: -9.14 })).rejects.toThrow(
      'dentro do Brasil',
    )
    expect(m.update).not.toHaveBeenCalled()
  })
})

describe('geocodeOwnerPousadaAddress', () => {
  it('busca o endereço SALVO da pousada (nada vem do navegador)', async () => {
    m.geocode.mockResolvedValue({ status: 'not_found' })
    await geocodeOwnerPousadaAddress()
    expect(m.geocode).toHaveBeenCalledWith({
      address: 'Rua das Acácias, 100',
      cep: '37418-000',
      city: 'São Tomé das Letras',
      state: 'MG',
    })
  })

  it('quem não edita a pousada não usa a busca', async () => {
    m.role = 'recepcionista'
    await expect(geocodeOwnerPousadaAddress()).rejects.toThrow('permissão')
    expect(m.geocode).not.toHaveBeenCalled()
  })
})
