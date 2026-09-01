'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { selectPousadaSchema } from './schemas'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { ACTIVE_POUSADA_COOKIE } from '@/lib/auth/tenant-context'
import { logAudit } from '@/lib/audit/log'

/**
 * Troca a pousada ativa (Ciclo 2 — item 7). O id vindo do cliente nunca é
 * confiado diretamente: só é aceito se corresponder a um membership ATIVO
 * real do usuário autenticado — nunca um `property_id` de payload cru.
 */
export const selectActivePousadaAction = createAction(selectPousadaSchema, async (input) => {
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')

  const membership = user.memberships.find(
    (m) => m.pousadaId === input.pousadaId && m.status === 'active',
  )
  if (!membership) {
    throw new Error('Você não tem um vínculo ativo com esta pousada.')
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_POUSADA_COOKIE, membership.pousadaId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  await logAudit({
    actorId: user.id,
    action: 'tenant_context.select',
    targetTable: 'pousadas',
    targetId: membership.pousadaId,
  })

  revalidatePath('/dashboard')
  return { pousadaId: membership.pousadaId }
})
