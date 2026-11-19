'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { acceptContractSchema, publishContractSchema, saveContractDraftSchema } from './schemas'
import {
  CONTRACT_PANEL_PATH,
  acceptContract,
  publishContractVersion,
  saveContractDraft,
} from './services/contract.service'

/**
 * Endereço e navegador de quem aceita, para a prova. Na Vercel o primeiro
 * valor de `x-forwarded-for` é reescrito pela plataforma.
 */
async function requestProof(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '',
    userAgent: h.get('user-agent') ?? '',
  }
}

export const acceptContractAction = createAction(acceptContractSchema, async (input) => {
  const result = await acceptContract(
    { versionId: input.versionId, bodySha256: input.bodySha256 },
    await requestProof(),
  )
  revalidatePath(CONTRACT_PANEL_PATH)
  revalidatePath('/dashboard')
  return result
})

export const saveContractDraftAction = createAction(saveContractDraftSchema, async (input) => {
  const result = await saveContractDraft(input)
  revalidatePath('/admin/configuracoes')
  return result
})

export const publishContractVersionAction = createAction(publishContractSchema, async (input) => {
  const result = await publishContractVersion(input.code)
  revalidatePath('/admin/configuracoes')
  return result
})
