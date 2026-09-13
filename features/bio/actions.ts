'use server'

import { createAction } from '@/actions/create-action'
import { quoteRequestSchema, quoteStatusSchema } from './schemas'
import { submitQuoteRequest, updateQuoteStatus } from './services/bio.service'

/** Pública — chamada pelo formulário da página da bio, sem sessão. */
export const submitQuoteRequestAction = createAction(quoteRequestSchema, async (input) => {
  return submitQuoteRequest(input)
})

/** Painel — a pousada marca o que fez com o pedido. */
export const updateQuoteStatusAction = createAction(quoteStatusSchema, async (input) => {
  return updateQuoteStatus(input)
})
