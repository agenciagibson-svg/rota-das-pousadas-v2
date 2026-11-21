'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { offerConsentSchema, sendOfferSchema } from './schemas'
import { sendOffer, setMyOfferConsent } from './services/offers.service'

export const sendOfferAction = createAction(sendOfferSchema, async (input) => {
  const result = await sendOffer(input)
  revalidatePath('/dashboard/marketing')
  return result
})

export const setOfferConsentAction = createAction(offerConsentSchema, async (input) => {
  await setMyOfferConsent(input.pousadaId, input.granted)
  revalidatePath('/conta/ofertas')
  return { granted: input.granted }
})
