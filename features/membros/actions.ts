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
} from './services/team.service'

export const inviteMemberAction = createAction(inviteMemberSchema, async (input) => {
  await inviteMember(input)
  revalidatePath('/dashboard/membros')
  return { processed: true as const }
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
