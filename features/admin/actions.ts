'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { grantAccessSchema, grantIdSchema, pousadaIdSchema, createPousadaAdminSchema } from './schemas'
import {
  approvePousada,
  rejectPousada,
  grantSensitiveAccess,
  revokeSensitiveAccess,
  createPousadaAsAdmin,
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
