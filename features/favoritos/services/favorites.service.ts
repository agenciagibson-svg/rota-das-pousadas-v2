import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import {
  addPousadaFavorite,
  isPousadaFavorite,
  listFavoritePousadas,
  togglePousadaFavorite,
} from '@/repositories/favorites.repository'
import type { Pousada } from '@/types'

export async function getFavoriteState(slug: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return isPousadaFavorite(user.id, slug)
}

export async function toggleFavorite(slug: string): Promise<{ favorite: boolean }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Entre na sua conta para salvar favoritos.')
  return togglePousadaFavorite(user.id, slug)
}

/** Garante que a pousada está nos favoritos (não desfaz se já estiver). */
export async function ensureFavorite(slug: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Entre na sua conta para salvar favoritos.')
  await addPousadaFavorite(user.id, slug)
}

export async function listMyFavorites(): Promise<Pousada[]> {
  const user = await getCurrentUser()
  if (!user) return []
  return listFavoritePousadas(user.id)
}
