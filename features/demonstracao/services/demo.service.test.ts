import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getDemoPousadaRpc: vi.fn(),
  createDemoLinkRpc: vi.fn(),
  revokeDemoLinkRpc: vi.fn(),
  listDemoLinksRpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: () => true }))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/demo-links.repository', () => ({
  getDemoPousadaRpc: mocks.getDemoPousadaRpc,
  createDemoLinkRpc: mocks.createDemoLinkRpc,
  revokeDemoLinkRpc: mocks.revokeDemoLinkRpc,
  listDemoLinksRpc: mocks.listDemoLinksRpc,
}))
vi.mock('@/repositories/pousadas.repository', () => ({
  rowToPousada: (r: Record<string, unknown>) => ({
    slug: r.slug,
    name: r.name,
    rating: Number(r.rating),
    reviews: r.reviews,
    gallery: r.gallery,
    tags: r.tags,
  }),
}))

import { createDemoLink, getDemoPage, listDemoLinks, revokeDemoLink } from './demo.service'

const TOKEN = 'Ab3_Cd4-Ef5Gh6Ij7Kl8Mn9Op0Qr1St2Uv3Wx4Yz5Ab'
const POUSADA_ID = '10000000-0000-0000-0000-000000010101'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDemoPage', () => {
  it('token fora do formato nem consulta o banco', async () => {
    expect(await getDemoPage('../admin')).toBeNull()
    expect(mocks.getDemoPousadaRpc).not.toHaveBeenCalled()
  })

  it('pousada já publicada: devolve o endereço de verdade', async () => {
    mocks.getDemoPousadaRpc.mockResolvedValue({ published: true, slug: 'mirante' })
    expect(await getDemoPage(TOKEN)).toEqual({ kind: 'published', slug: 'mirante' })
  })

  it('demonstração: nota de semente zerada e acomodações lidas', async () => {
    mocks.getDemoPousadaRpc.mockResolvedValue({
      published: false,
      pousada: {
        slug: 'mirante',
        name: 'Mirante',
        rating: 4.9,
        reviews: 0,
        gallery: ['a.jpg'],
        tags: [],
      },
      rooms: [{ id: 'r1', name: 'Chalé', base_price: 590, capacity: 2, gallery: [] }],
    })
    const page = await getDemoPage(TOKEN)
    expect(page?.kind).toBe('demo')
    if (page?.kind !== 'demo') return
    expect(page.pousada.rating).toBe(0)
    expect(page.pousada.gallery).toEqual(['a.jpg'])
    expect(page.rooms).toHaveLength(1)
  })

  it('link desativado: nada', async () => {
    mocks.getDemoPousadaRpc.mockResolvedValue(null)
    expect(await getDemoPage(TOKEN)).toBeNull()
  })
})

describe('permissão (comercial e master)', () => {
  it('marketing não gera, não desativa e não vê a lista', async () => {
    mocks.getCurrentUser.mockResolvedValue({ platformRole: 'marketing' })
    await expect(createDemoLink(POUSADA_ID, false)).rejects.toThrow(/permissão/)
    await expect(revokeDemoLink(POUSADA_ID)).rejects.toThrow(/permissão/)
    expect(await listDemoLinks()).toEqual({})
    expect(mocks.createDemoLinkRpc).not.toHaveBeenCalled()
    expect(mocks.listDemoLinksRpc).not.toHaveBeenCalled()
  })

  it('sem papel de plataforma (dono de pousada) não gera', async () => {
    mocks.getCurrentUser.mockResolvedValue({ platformRole: null })
    await expect(createDemoLink(POUSADA_ID, false)).rejects.toThrow(/permissão/)
  })

  it('comercial gera e lista por pousada', async () => {
    mocks.getCurrentUser.mockResolvedValue({ platformRole: 'comercial' })
    mocks.createDemoLinkRpc.mockResolvedValue(TOKEN)
    mocks.listDemoLinksRpc.mockResolvedValue([
      { pousadaId: POUSADA_ID, token: TOKEN, active: true, views: 2 },
    ])
    expect(await createDemoLink(POUSADA_ID, true)).toBe(TOKEN)
    expect(mocks.createDemoLinkRpc).toHaveBeenCalledWith(POUSADA_ID, true)
    expect((await listDemoLinks())[POUSADA_ID]?.views).toBe(2)
  })
})
