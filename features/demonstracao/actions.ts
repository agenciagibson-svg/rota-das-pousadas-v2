'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { createDemoLink, revokeDemoLink } from './services/demo.service'

const createDemoLinkSchema = z.object({
  pousadaId: z.string().uuid('Identificador inválido.'),
  renew: z.boolean(),
})
const revokeDemoLinkSchema = z.object({ pousadaId: z.string().uuid('Identificador inválido.') })

/** Gera (ou troca) o link de demonstração de uma pousada não publicada — /admin → Pousadas. */
export const createDemoLinkAction = createAction(createDemoLinkSchema, async (input) => {
  const token = await createDemoLink(input.pousadaId, input.renew)
  revalidatePath('/admin/pousadas')
  return { token }
})

/** Desativa o link: quem tiver o endereço passa a ver "link não encontrado". */
export const revokeDemoLinkAction = createAction(revokeDemoLinkSchema, async (input) => {
  await revokeDemoLink(input.pousadaId)
  revalidatePath('/admin/pousadas')
  return { ok: true as const }
})
