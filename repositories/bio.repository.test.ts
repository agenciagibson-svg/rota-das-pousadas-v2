import { describe, expect, it, vi } from 'vitest'

// Modo demonstração: /[slug] (bio da pousada) e qualquer endereço de um nível
// que não existe passam por getBioPousadaBySlug. Sem Supabase, ela usa os
// dados de exemplo em vez de lançar "Your project's URL and Key are required…".
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => false,
  // Fora de produção: o modo demonstração pode usar os dados de exemplo.
  assertNotMockInProduction: () => {},
  publicEnv: { siteUrl: 'http://localhost:3000', supabaseUrl: '', supabaseAnonKey: '' },
}))
const createClient = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))

describe('getBioPousadaBySlug no modo demonstração', () => {
  it('monta a bio a partir da pousada de exemplo', async () => {
    const { getBioPousadaBySlug } = await import('./bio.repository')
    const bio = await getBioPousadaBySlug('refugio-das-nuvens')

    expect(createClient).not.toHaveBeenCalled()
    expect(bio).toMatchObject({
      slug: 'refugio-das-nuvens',
      name: 'Refúgio das Nuvens',
      city: 'Monte Verde',
      pricePerNight: 720,
      published: true,
    })
  })

  it('devolve null para um endereço que não é de pousada', async () => {
    const { getBioPousadaBySlug } = await import('./bio.repository')
    expect(await getBioPousadaBySlug('pagina-inexistente')).toBeNull()
  })
  it('lista a acomodação padrão da pousada de exemplo', async () => {
    const { listBookableRooms } = await import('./bio.repository')
    const rooms = await listBookableRooms('refugio-das-nuvens', null, null, 2)
    expect(rooms).toEqual([
      expect.objectContaining({ name: 'Acomodação principal', basePrice: 720, capacity: 4 }),
    ])
    expect(createClient).not.toHaveBeenCalled()
  })
})
