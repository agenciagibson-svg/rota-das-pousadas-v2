import { z } from 'zod'

/** Papéis de tenant atribuíveis via a tela de equipe (nunca papéis de plataforma). */
const teamRoles = [
  'proprietario',
  'admin_pousada',
  'recepcionista',
  'financeiro_pousada',
  'governanca',
] as const

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  role: z.enum(teamRoles),
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

export const membershipIdSchema = z.object({
  membershipId: z.string().uuid('Vínculo inválido.'),
})
export type MembershipIdInput = z.infer<typeof membershipIdSchema>

export const updateRoleSchema = z.object({
  membershipId: z.string().uuid('Vínculo inválido.'),
  role: z.enum(teamRoles),
})
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

export const suspendMemberSchema = z.object({
  membershipId: z.string().uuid('Vínculo inválido.'),
  reason: z.string().trim().min(5, 'Descreva o motivo da suspensão.').max(500, 'Motivo muito longo.'),
})
export type SuspendMemberInput = z.infer<typeof suspendMemberSchema>
