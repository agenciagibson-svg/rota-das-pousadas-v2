import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureFavorite, getFavoriteState, toggleFavorite } from './favorites.service'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  addPousadaFavorite: vi.fn(),
  isPousadaFavorite: vi.fn(),
  togglePousadaFavorite: vi.fn(),
}))

vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/repositories/favorites.repository', () => ({
  addPousadaFavorite: mocks.addPousadaFavorite,
  isPousadaFavorite: mocks.isPousadaFavorite,
  listFavoritePousadas: vi.fn(),
  togglePousadaFavorite: mocks.togglePousadaFavorite,
}))

const SLUG = 'pousada-teste'
const PUBLISHED = new Set([SLUG, 'outra-pousada'])

/**
 * Repositório em memória com o mesmo contrato do de verdade: `add` é inserção
 * idempotente (nunca remove; repetir não muda nada), `toggle` inverte o estado
 * atual (insere se não existe, apaga se existe) e pousada fora do ar nunca é
 * favorita — `add` e `toggle` lançam "Pousada não encontrada." para ela.
 */
let favorites: Set<string>
const key = (userId: string, slug: string) => `${userId}:${slug}`

beforeEach(() => {
  vi.resetAllMocks()
  favorites = new Set()
  mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', name: 'Viajante Teste' })
  mocks.isPousadaFavorite.mockImplementation(
    async (userId: string, slug: string) => PUBLISHED.has(slug) && favorites.has(key(userId, slug)),
  )
  mocks.addPousadaFavorite.mockImplementation(async (userId: string, slug: string) => {
    if (!PUBLISHED.has(slug)) throw new Error('Pousada não encontrada.')
    favorites.add(key(userId, slug))
  })
  mocks.togglePousadaFavorite.mockImplementation(async (userId: string, slug: string) => {
    if (!PUBLISHED.has(slug)) throw new Error('Pousada não encontrada.')
    const k = key(userId, slug)
    if (favorites.has(k)) {
      favorites.delete(k)
      return { favorite: false }
    }
    favorites.add(k)
    return { favorite: true }
  })
})

describe('ensureFavorite (salvar nos favoritos por link de fora do site)', () => {
  it('exige login e não toca nos favoritos de ninguém', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    await expect(ensureFavorite(SLUG)).rejects.toThrow('Entre na sua conta para salvar favoritos.')
    expect(mocks.addPousadaFavorite).not.toHaveBeenCalled()
    expect(mocks.isPousadaFavorite).not.toHaveBeenCalled()
    expect(mocks.togglePousadaFavorite).not.toHaveBeenCalled()
  })

  it('pede ao repositório para garantir o favorito de quem está logado, sem alternar', async () => {
    await ensureFavorite(SLUG)

    expect(mocks.addPousadaFavorite).toHaveBeenCalledTimes(1)
    expect(mocks.addPousadaFavorite).toHaveBeenCalledWith('user-1', SLUG)
    expect(mocks.togglePousadaFavorite).not.toHaveBeenCalled()
  })

  it('salva a pousada que ainda não era favorita', async () => {
    await ensureFavorite(SLUG)

    expect(await getFavoriteState(SLUG)).toBe(true)
  })

  it('não desfaz um favorito que já existia', async () => {
    favorites.add(key('user-1', SLUG))

    await ensureFavorite(SLUG)

    expect(await getFavoriteState(SLUG)).toBe(true)
  })

  it('abrir o mesmo link várias vezes mantém a pousada salva', async () => {
    await ensureFavorite(SLUG)
    await ensureFavorite(SLUG)
    await ensureFavorite(SLUG)

    expect(await getFavoriteState(SLUG)).toBe(true)
  })

  it('salva para quem está logado, sem mexer nos favoritos de outra pessoa', async () => {
    favorites.add(key('user-2', 'outra-pousada'))

    await ensureFavorite(SLUG)

    expect([...favorites].sort()).toEqual(['user-1:pousada-teste', 'user-2:outra-pousada'])
  })

  it('pousada inexistente ou fora do ar: avisa que não foi encontrada e nada é salvo', async () => {
    await expect(ensureFavorite('pousada-que-nao-existe')).rejects.toThrow(
      'Pousada não encontrada.',
    )
    expect(favorites.size).toBe(0)
  })

  it('diferente do botão de coração, que alterna: salvar duas vezes não remove', async () => {
    await toggleFavorite(SLUG)
    await toggleFavorite(SLUG)
    expect(await getFavoriteState(SLUG)).toBe(false)

    await ensureFavorite(SLUG)
    await ensureFavorite(SLUG)
    expect(await getFavoriteState(SLUG)).toBe(true)
  })

  // Regressão: com "confere e depois alterna", duas confirmações simultâneas
  // (duplo clique no formulário sem JavaScript, ou o link aberto em duas abas)
  // liam "não é favorito" ao mesmo tempo e a segunda APAGAVA o favorito.
  it('duas confirmações simultâneas ainda terminam com a pousada salva', async () => {
    await Promise.all([ensureFavorite(SLUG), ensureFavorite(SLUG)])

    expect(await getFavoriteState(SLUG)).toBe(true)
    expect([...favorites]).toEqual(['user-1:pousada-teste'])
  })

  it('falha do banco ao salvar chega a quem chamou (não finge que salvou)', async () => {
    mocks.addPousadaFavorite.mockRejectedValue(new Error('banco indisponível'))

    await expect(ensureFavorite(SLUG)).rejects.toThrow('banco indisponível')
  })
})
