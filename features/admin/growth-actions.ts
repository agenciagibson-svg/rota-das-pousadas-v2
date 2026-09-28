'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { GROWTH_STAGES } from './growth'
import { addActivity, requestGrowthHelp, saveOpportunity } from './services/growth.service'

const optionalMoney = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || v === '' ? null : Number(String(v).replace(',', '.'))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1_000_000), 'Valor inválido.')
const optionalDate = z
  .union([z.string(), z.null()])
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data inválida.')

const opportunitySchema = z.object({
  pousadaId: z.string().uuid(),
  stage: z.enum(GROWTH_STAGES),
  serviceFee: optionalMoney,
  adBudget: optionalMoney,
  nextContact: optionalDate,
  campaignStart: optionalDate,
  campaignEnd: optionalDate,
  lostReason: z.string().trim().max(300, 'Use no máximo 300 caracteres.').default(''),
})

const activitySchema = z.object({
  pousadaId: z.string().uuid(),
  kind: z.enum(['nota', 'contato']),
  body: z.string().trim().min(1, 'Escreva a anotação.').max(1000, 'Use no máximo 1000 caracteres.'),
})

export const saveOpportunityAction = createAction(opportunitySchema, async (parsed) => {
  const input = opportunitySchema.parse(parsed)
  if (input.stage === 'campanha_ativa' && !input.campaignStart) {
    throw new Error('Informe a data de início da campanha.')
  }
  await saveOpportunity(input)
  revalidatePath('/admin/plano-de-acao')
  return { ok: true as const }
})

export const addActivityAction = createAction(activitySchema, async (parsed) => {
  const input = activitySchema.parse(parsed)
  await addActivity(input.pousadaId, input.kind, input.body)
  revalidatePath('/admin/plano-de-acao')
  return { ok: true as const }
})

export const requestGrowthHelpAction = createAction(z.object({}), async () => {
  const res = await requestGrowthHelp()
  revalidatePath('/dashboard')
  return res
})
