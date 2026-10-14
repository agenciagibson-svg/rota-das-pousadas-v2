import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { requireCapability as requireTenantCapability } from '@/lib/auth/require-capability'
import type { Action, Role } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import {
  listMembershipsByPousada,
  getMembershipById,
  countActiveOwners,
  inviteMembership,
  updateMembershipRole,
  suspendMembership,
  reactivateMembership,
  revokeMembership,
  acceptInviteRpc,
  declineInviteRpc,
  listPousadaNamesByIds,
} from '@/repositories/memberships.repository'
import { wouldLeaveNoActiveOwner, isSelfAction } from '@/features/membros/rules'
import { sendEmail } from '@/lib/email/mailer'
import { memberInviteEmail } from '@/lib/email/templates'
import { publicEnv } from '@/lib/env'
import { roleLabel } from '@/features/membros/components/role-labels'
import type { PendingInvite, TeamMember } from '@/features/membros/types'

/** Usuário autenticado + papel na pousada ativa (guarda única em lib/auth). */
async function requireCapability(action: Action) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  return { user, ...(await requireTenantCapability(action)) }
}

/** Garante que o vínculo alvo pertence à pousada ativa — nunca confia só no id recebido. */
async function requireMembershipInActivePousada(membershipId: string, pousadaId: string) {
  const membership = await getMembershipById(membershipId)
  if (!membership || membership.pousadaId !== pousadaId) {
    throw new Error('Vínculo não encontrado nesta pousada.')
  }
  return membership
}

export async function listTeam(): Promise<TeamMember[]> {
  const { pousadaId } = await requireCapability('member:view')
  return listMembershipsByPousada(pousadaId)
}

/**
 * Convida por e-mail. A resposta é deliberadamente NEUTRA (não distingue
 * "e-mail sem conta na plataforma" de "convite criado") — evita transformar
 * este fluxo num oráculo de enumeração de usuários. Ver
 * supabase/migrations/0017_find_profile_by_email_fn.sql (invite_membership).
 * Erros de autorização ou de vínculo já existente NA MESMA POUSADA continuam
 * explícitos — só a existência da conta em si fica neutra.
 */
export async function inviteMember(input: { email: string; role: Role }): Promise<boolean> {
  const { user, pousadaId } = await requireCapability('member:invite')

  await inviteMembership({ pousadaId, email: input.email, role: input.role })

  // Não sabemos (nem devemos saber, no app) se um vínculo foi de fato criado
  // — a RPC não retorna essa informação de propósito. O evento de auditoria
  // registra a TENTATIVA, feita por quem tinha permissão, não o resultado.
  // (invite_membership não grava auditoria própria — diferente das 4 RPCs de
  // gestão abaixo, que gravam atomicamente e por isso não duplicamos aqui.)
  await logAudit({
    actorId: user.id,
    action: 'member.invite_attempted',
    targetTable: 'pousadas',
    targetId: pousadaId,
    metadata: { role: input.role },
  })

  // E-mail de convite: vai para o endereço digitado em qualquer caso (o texto
  // serve para quem tem e para quem não tem conta), então não revela nada.
  // Falha de envio não desfaz o convite — sendEmail nunca lança.
  const [pousada] = await listPousadaNamesByIds([pousadaId])
  const mail = memberInviteEmail({
    pousadaName: pousada?.name ?? 'sua pousada',
    roleLabel: roleLabel(input.role),
    inviterName: user.name || null,
    email: input.email.trim().toLowerCase(),
    dashboardUrl: new URL('/dashboard', publicEnv.siteUrl).toString(),
    signupUrl: new URL('/cadastro', publicEnv.siteUrl).toString(),
  })
  return sendEmail({ to: input.email.trim(), ...mail })
}

/**
 * [Ciclo 2C] `updateMemberRole`/`suspendMember`/`reactivateMember`/`revokeMember`
 * abaixo chamam RPCs `SECURITY DEFINER` (update_member_role, suspend_member,
 * reactivate_member, revoke_member) que já reimplementam TODAS as checagens
 * — último proprietário ativo, autopromoção, vínculo pertence à pousada — no
 * próprio Postgres. As checagens aqui em cima são só a PRIMEIRA barreira
 * (feedback rápido de UX, sem round-trip); a RPC é quem garante a regra de
 * verdade, inclusive contra um cliente que chame a API direto. Por isso a
 * auditoria NÃO é gravada aqui — a RPC já grava, atomicamente, na mesma
 * transação da mutação; gravar de novo aqui duplicaria o evento.
 */
export async function updateMemberRole(membershipId: string, role: Role): Promise<void> {
  const { user, pousadaId } = await requireCapability('member:update_role')
  const membership = await requireMembershipInActivePousada(membershipId, pousadaId)

  if (isSelfAction(membership.userId, user.id)) {
    throw new Error('Você não pode alterar seu próprio papel.')
  }
  if (membership.role === 'proprietario' && role !== 'proprietario') {
    const owners = await countActiveOwners(pousadaId)
    if (wouldLeaveNoActiveOwner(membership.role, owners)) {
      throw new Error('A pousada precisa de ao menos um proprietário ativo.')
    }
  }

  await updateMembershipRole(pousadaId, membershipId, role)
}

export async function suspendMember(membershipId: string, reason: string): Promise<void> {
  const { pousadaId } = await requireCapability('member:suspend')
  const membership = await requireMembershipInActivePousada(membershipId, pousadaId)

  // Autossuspensão só é bloqueada quando o alvo é o último proprietário ativo
  // (mesma regra da RPC) — não é mais um bloqueio incondicional.
  const owners = await countActiveOwners(pousadaId)
  if (wouldLeaveNoActiveOwner(membership.role, owners)) {
    throw new Error('A pousada precisa de ao menos um proprietário ativo.')
  }

  await suspendMembership(pousadaId, membershipId, reason)
}

export async function reactivateMember(membershipId: string): Promise<void> {
  const { pousadaId } = await requireCapability('member:suspend')
  await requireMembershipInActivePousada(membershipId, pousadaId)

  await reactivateMembership(pousadaId, membershipId)
}

export async function revokeMember(membershipId: string): Promise<void> {
  const { pousadaId } = await requireCapability('member:revoke')
  const membership = await requireMembershipInActivePousada(membershipId, pousadaId)

  const owners = await countActiveOwners(pousadaId)
  if (wouldLeaveNoActiveOwner(membership.role, owners)) {
    throw new Error('A pousada precisa de ao menos um proprietário ativo.')
  }

  await revokeMembership(pousadaId, membershipId)
}

/**
 * [0049] Resposta ao convite — fluxo do CONVIDADO, não da equipe. Não passa
 * por `requireCapability`: quem responde ainda não tem vínculo ativo (e pode
 * não ter nenhum). A primeira barreira confere que o convite está na sessão do
 * usuário como `invited`; a RPC repete isso com lock de linha.
 */
async function requireOwnInvite(membershipId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  const invite = user.memberships.find((m) => m.id === membershipId && m.status === 'invited')
  if (!invite) throw new Error('Convite não encontrado.')
  return { user, invite }
}

export async function acceptInvite(membershipId: string): Promise<{ pousadaId: string }> {
  await requireOwnInvite(membershipId)
  return acceptInviteRpc(membershipId)
}

export async function declineInvite(membershipId: string): Promise<void> {
  await requireOwnInvite(membershipId)
  await declineInviteRpc(membershipId)
}

/** Convites pendentes do usuário atual, com o nome da pousada — para a tela de entrada do painel. */
export async function listMyPendingInvites(): Promise<PendingInvite[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const invited = user.memberships.filter((m) => m.status === 'invited')
  if (invited.length === 0) return []
  const pousadas = await listPousadaNamesByIds(invited.map((m) => m.pousadaId))
  return invited.map((m) => ({
    membershipId: m.id,
    pousadaId: m.pousadaId,
    pousadaName: pousadas.find((p) => p.id === m.pousadaId)?.name ?? 'uma pousada',
    role: m.role,
  }))
}
