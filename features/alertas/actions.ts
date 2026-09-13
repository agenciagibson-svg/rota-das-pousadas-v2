'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { toggleMyFavoriteAlert } from './services/favorite-alerts.service'

const favoriteAlertSchema = z.object({
  slug: z.string().min(1, 'Pousada inválida.'),
})

export const toggleFavoriteAlertAction = createAction(favoriteAlertSchema, async (input) => {
  const result = await toggleMyFavoriteAlert(input.slug)
  revalidatePath('/favoritos')
  return result
})
