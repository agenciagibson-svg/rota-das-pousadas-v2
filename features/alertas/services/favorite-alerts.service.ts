import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import {
  listFavoriteAlertStates,
  toggleFavoriteAlert,
} from '@/repositories/favorite-alerts.repository'

export async function listMyFavoriteAlertStates() {
  const user = await getCurrentUser()
  if (!user) return []
  return listFavoriteAlertStates(user.id)
}

export async function toggleMyFavoriteAlert(slug: string): Promise<{ active: boolean }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Entre na sua conta para ativar alertas.')
  return toggleFavoriteAlert(user.id, slug)
}
