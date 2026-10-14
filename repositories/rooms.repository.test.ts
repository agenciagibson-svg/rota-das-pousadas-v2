import { describe, expect, it, vi } from 'vitest'

// Modo demonstração: sem Supabase, a página da pousada precisa da acomodação
// reservável vinda dos dados de exemplo, em vez de tentar criar um cliente do
// Supabase (que lança "Your project's URL and Key are required…").
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => false,
  publicEnv: { siteUrl: 'http://localhost:3000', supabaseUrl: '', supabaseAnonKey: '' },
}))
const createClient = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))

describe('getBookableRoomBySlug no modo demonstração', () => {
  it('devolve a acomodação padrão com a diária da pousada de exemplo', async () => {
    const { getBookableRoomBySlug } = await import('./rooms.repository')
    const room = await getBookableRoomBySlug('refugio-das-nuvens')

    expect(createClient).not.toHaveBeenCalled()
    expect(room).toMatchObject({
      name: 'Acomodação principal',
      description: 'Acomodação padrão da pousada.',
      nightly: 720,
      capacity: 4,
    })
  })

  it('devolve null para uma pousada que não existe', async () => {
    const { getBookableRoomBySlug } = await import('./rooms.repository')
    expect(await getBookableRoomBySlug('nao-existe')).toBeNull()
  })
})
