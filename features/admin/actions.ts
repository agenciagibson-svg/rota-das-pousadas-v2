'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  grantAccessSchema,
  grantIdSchema,
  pousadaIdSchema,
  createPousadaAdminSchema,
  changePousadaStatusSchema,
  linkPousadaOwnerSchema,
  destinationInputSchema,
  updateDestinationInputSchema,
  destinationIdSchema,
  assignPlatformRoleSchema,
  revokePlatformRoleSchema,
  createPlatformExpenseSchema,
  setPlatformExpensePaidSchema,
} from './schemas'
import {
  approvePousada,
  rejectPousada,
  grantSensitiveAccess,
  revokeSensitiveAccess,
  createPousadaAsAdmin,
  changePousadaStatus,
  linkPousadaOwner,
  createDestinationAdmin,
  updateDestinationAdmin,
  deleteDestinationAdmin,
  assignPlatformRole,
  revokePlatformRole,
  addPlatformExpense,
  markPlatformExpensePaid,
  bootstrapPlatformPlanAdmin,
  sendSentryTestAdmin,
} from './services/admin.service'

export const createPousadaAdminAction = createAction(createPousadaAdminSchema, async (input) => {
  const { slug } = await createPousadaAsAdmin(input)
  revalidatePath('/admin')
  revalidatePath('/admin/pousadas')
  revalidatePath('/')
  revalidatePath('/sitemap.xml')
  // Rascunho não tem página pública (daria 404): volta para a lista do admin.
  const redirectTo = input.publishNow ? `/pousada/${slug}` : '/admin/pousadas'
  return { slug, redirectTo }
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

/** Cria um destino (curadoria da home) — comercial/marketing/master. */
export const createDestinationAction = createAction(destinationInputSchema, async (input) => {
  const { slug } = await createDestinationAdmin(input)
  revalidatePath('/admin/destinos')
  revalidatePath('/')
  return { slug }
})

/** Edita um destino existente. */
export const updateDestinationAction = createAction(
  updateDestinationInputSchema,
  async ({ id, ...input }) => {
    const { slug } = await updateDestinationAdmin(id, input)
    revalidatePath('/admin/destinos')
    revalidatePath('/')
    return { id, slug }
  },
)

/** Remove um destino — a RPC bloqueia se houver pousada vinculada. */
export const deleteDestinationAction = createAction(destinationIdSchema, async ({ id }) => {
  await deleteDestinationAdmin(id)
  revalidatePath('/admin/destinos')
  revalidatePath('/')
  return { id }
})

/** Atribui (ou troca) o papel de plataforma de um e-mail já cadastrado — só master. */
export const assignPlatformRoleAction = createAction(assignPlatformRoleSchema, async (input) => {
  await assignPlatformRole(input)
  revalidatePath('/admin/configuracoes')
  return { email: input.email }
})

/** Remove o papel de plataforma de um e-mail — só master. */
export const revokePlatformRoleAction = createAction(
  revokePlatformRoleSchema,
  async ({ email }) => {
    await revokePlatformRole(email)
    revalidatePath('/admin/configuracoes')
    return { email }
  },
)

/** Lança uma conta a pagar da própria Rota — financeiro_plataforma/master. */
export const createPlatformExpenseAction = createAction(
  createPlatformExpenseSchema,
  async (input) => {
    await addPlatformExpense(input)
    revalidatePath('/admin/financeiro')
    return { ok: true as const }
  },
)

/** Marca/desmarca uma despesa da Rota como paga. */
export const setPlatformExpensePaidAction = createAction(
  setPlatformExpensePaidSchema,
  async (input) => {
    await markPlatformExpensePaid(input.expenseId, input.paid)
    revalidatePath('/admin/financeiro')
    return { expenseId: input.expenseId, paid: input.paid }
  },
)

/** Cria o plano de assinatura de verdade no Mercado Pago — só master, uma vez. */
export const bootstrapPlatformPlanAction = createAction(z.object({}), async () => {
  await bootstrapPlatformPlanAdmin()
  revalidatePath('/admin/financeiro')
  return { ok: true as const }
})

/** Manda um erro de teste ao Sentry e diz se chegou — só master. */
export const sendSentryTestAction = createAction(z.object({}), async () => sendSentryTestAdmin())
