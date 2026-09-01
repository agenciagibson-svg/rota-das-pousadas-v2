'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { guestFormSchema } from './schemas'
import { saveGuest } from './services/guests.service'

export const saveGuestAction = createAction(guestFormSchema, async (input) => {
  const { id } = await saveGuest(input)
  revalidatePath('/dashboard/hospedes')
  revalidatePath(`/dashboard/hospedes/${id}`)
  return { guestId: id }
})
