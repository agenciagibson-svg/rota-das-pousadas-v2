'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  grantAccessSchema,
  grantIdSchema,
  pousadaIdSchema,
  createPousadaAdminSchema,
  changePousadaStatusSchema,
  linkPousadaOwnerSchema,
} from './schemas'
import {
  approvePousada,
  rejectPousada,
  grantSensitiveAccess,
  revokeSensitiveAccess,
  createPousadaAsAdmin,
  changePousadaStatus,
  linkPousadaOwner,
} from './services/admin.service'

export const createPousadaAdminAction = createAction(createPousadaAdminSchema, async (input) => {
  const { slug } = await createPousadaAsAdmin(input)
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/sitemap.xml')
  return { slug, redirectTo: `/pousada/${slug}` as const }
})

export const approvePousadaAction = createAction(pousadaIdSchema, async ({ id }) => {
  const slug = await approvePousada(id)
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/sitemap.xml')
  if (slug) revalidatePath(`/pousada/${slug}`)
  return { id }
})

export const grantAccessAction = createAction(grantAccessSchema, async (input) => {
  const grant = await grantSensitiveAccess(input)
  revalidatePath('/admin')
  return grant
})

export const revokeAccessAction = createAction(grantIdSchema, async ({ id }) => {
  await revokeSensitiveAccess(id)
  revalidatePath('/admin')
  return { id }
})

export const rejectPousadaAction = createAction(pousadaIdSchema, async ({ id }) => {
  const slug = await rejectPousada(id)
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/sitemap.xml')
  if (slug) revalidatePath(`/pousada/${slug}`)
  return { id }
})

/** Vincula um e-mail já cadastrado como proprietário de uma pousada sem dono. */
export const linkPousadaOwnerAction = createAction(linkPousadaOwnerSchema, async (input) => {
  await linkPousadaOwner(input)
  revalidatePath('/admin/pousadas')
  return { id: input.pousadaId }
})

/** Suspender/reativar/arquivar uma pousada pela tela "Pousadas" do admin. */
export const changePousadaStatusAction = createAction(
  changePousadaStatusSchema,
  async ({ id, status }) => {
    await changePousadaStatus(id, status)
    revalidatePath('/admin/pousadas')
    revalidatePath('/')
    revalidatePath('/sitemap.xml')
    return { id, status }
  },
)
