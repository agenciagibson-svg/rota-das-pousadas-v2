'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { toggleFavorite } from './services/favorites.service'

const favoriteSchema = z.object({
  slug: z.string().min(1, 'Pousada invalida.'),
})

export const toggleFavoriteAction = createAction(favoriteSchema, async (input) => {
  const result = await toggleFavorite(input.slug)
  revalidatePath('/favoritos')
  revalidatePath(`/pousada/${input.slug}`)
  revalidatePath('/pousadas')
  return result
})
