'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { createPousadaSchema } from './schemas'
import { createPousada } from './services/onboarding.service'

export const createPousadaAction = createAction(createPousadaSchema, async (input) => {
  const { slug } = await createPousada(input)
  revalidatePath('/dashboard')
  return { slug, redirectTo: '/dashboard' as const }
})
