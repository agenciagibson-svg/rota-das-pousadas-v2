'use server'

import { createAction } from '@/actions/create-action'
import { moderateTipSchema, tipFormSchema } from './schemas'
import { moderateTipAdmin, submitBlogTip } from './services/tips.service'

/** Pública — formulário "Já fui e recomendo" no fim do guia, sem sessão. */
export const submitBlogTipAction = createAction(tipFormSchema, async (input) =>
  submitBlogTip(input),
)

/** Painel — aprovar ou recusar uma dica. */
export const moderateBlogTipAction = createAction(moderateTipSchema, async (input) => {
  await moderateTipAdmin(input.id, input.status)
  return { ok: true }
})
