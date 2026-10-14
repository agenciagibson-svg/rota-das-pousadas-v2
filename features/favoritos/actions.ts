'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { redirect } from 'next/navigation'
import { ensureFavorite, toggleFavorite } from './services/favorites.service'

/** Mesmo formato dos slugs de pousada: minúsculas, números e hífen. */
const favoriteSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120)

const favoriteSchema = z.object({
  slug: z.string().min(1, 'Pousada inválida.'),
})

export const toggleFavoriteAction = createAction(favoriteSchema, async (input) => {
  const result = await toggleFavorite(input.slug)
  revalidatePath('/favoritos')
  revalidatePath(`/pousada/${input.slug}`)
  revalidatePath('/pousadas')
  return result
})

/**
 * Confirmação de "salvar nos favoritos" quando a pessoa chega por um link de
 * fora do site (ver app/favoritos/salvar/[slug]/page.tsx). Formulário simples,
 * sem JavaScript: valida, salva e volta para a pousada.
 */
export async function confirmFavoriteAction(formData: FormData): Promise<void> {
  const parsed = favoriteSlugSchema.safeParse(formData.get('slug'))
  if (!parsed.success) redirect('/pousadas')
  await ensureFavorite(parsed.data)
  revalidatePath('/favoritos')
  redirect(`/pousada/${parsed.data}?favorito=salvo`)
}
