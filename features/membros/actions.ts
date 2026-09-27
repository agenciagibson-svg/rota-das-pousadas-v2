'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  inviteMemberSchema,
  membershipIdSchema,
  suspendMemberSchema,
  updateRoleSchema,
} from './schemas'
import {
  inviteMember,
  updateMemberRole,
  suspendMember,
  reactivateMember,
  revokeMember,
  acceptInvite,
  declineInvite,
} from './services/team.service'

export const inviteMemberAction = createAction(inviteMemberSchema, async (input) => {
  const emailSent = await inviteMember(input)
  revalidatePath('/dashboard/membros')
  return { processed: true as const, emailSent }
})

export const updateMemberRoleAction = createAction(updateRoleSchema, async (input) => {
  await updateMemberRole(input.membershipId, input.role)
  revalidatePath('/dashboard/membros')
  return { membershipId: input.membershipId }
})

export const suspendMemberAction = createAction(suspendMemberSchema, async (input) => {
  await suspendMember(input.membershipId, input.reason)
  revalidatePath('/dashboard/membros')
  return { membershipId: input.membershipId }
})

export const reactivateMemberAction = createAction(membershipIdSchema, async (input) => {
  await reactivateMember(input.membershipId)
  revalidatePath('/dashboard/membros')
  return { membershipId: input.membershipId }
})

export const revokeMemberAction = createAction(membershipIdSchema, async (input) => {
  await revokeMember(input.membershipId)
  revalidatePath('/dashboard/membros')
  return { membershipId: input.membershipId }
})

/** [0049] Convidado aceita — o layout do /dashboard reavalia o contexto de tenant na próxima renderização. */
export const acceptInviteAction = createAction(membershipIdSchema, async (input) => {
  const { pousadaId } = await acceptInvite(input.membershipId)
  revalidatePath('/dashboard', 'layout')
  return { pousadaId }
})

export const declineInviteAction = createAction(membershipIdSchema, async (input) => {
  await declineInvite(input.membershipId)
  revalidatePath('/dashboard', 'layout')
  return { membershipId: input.membershipId }
})
