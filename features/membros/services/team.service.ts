import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action, type Role } from '@/lib/auth/rbac'
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
} from '@/repositories/memberships.repository'
import { wouldLeaveNoActiveOwner, isSelfAction } from '@/features/membros/rules'
import type { TeamMember } from '@/features/membros/types'

async function requireCapability(action: Action) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !can(role, action)) throw new Error('Você não tem permissão para esta ação.')
  return { user, pousadaId, role }
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
export async function inviteMember(input: { email: string; role: Role }): Promise<void> {
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

  // Envio de e-mail ainda não integrado — a UI mostra "se existir uma conta
  // com esse e-mail, o convite foi registrado" (não simula envio nem
  // confirma existência).
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
