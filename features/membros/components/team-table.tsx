'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, RotateCcw, ShieldOff, Users2 } from 'lucide-react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import type { ActionResult } from '@/types'
import { can } from '@/lib/auth/rbac'
import { useDashboardRole } from '@/components/dashboard/role-context'
import type { TeamMember } from '../types'
import {
  updateMemberRoleAction,
  suspendMemberAction,
  reactivateMemberAction,
  revokeMemberAction,
} from '../actions'
import { MEMBERSHIP_STATUS_LABEL, TEAM_ROLE_LABEL, roleLabel, type TeamRole } from './role-labels'

const ASSIGNABLE_ROLES: TeamRole[] = [
  'proprietario',
  'admin_pousada',
  'recepcionista',
  'financeiro_pousada',
  'governanca',
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

export function TeamTable({
  members,
  currentUserId,
}: {
  members: TeamMember[]
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<TeamMember | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<TeamMember | null>(null)
  const [reason, setReason] = useState('')
  // Quem só enxerga a equipe (ex.: admin da pousada) não vê controles que o servidor recusaria.
  const role = useDashboardRole()
  const canChangeRole = !!role && can(role, 'member:update_role')
  const canSuspend = !!role && can(role, 'member:suspend')
  const canRevoke = !!role && can(role, 'member:revoke')

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="Nenhum membro ainda"
        description="Convide alguém para sua equipe."
      />
    )
  }

  function run(promise: Promise<ActionResult<unknown>>) {
    setError(null)
    startTransition(async () => {
      const result = await promise
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function changeRole(membershipId: string, role: string) {
    run(updateMemberRoleAction({ membershipId, role }))
  }

  function confirmSuspend() {
    if (!suspendTarget) return
    const target = suspendTarget
    setSuspendTarget(null)
    run(suspendMemberAction({ membershipId: target.id, reason }))
    setReason('')
  }

  function confirmRevoke() {
    if (!revokeTarget) return
    const target = revokeTarget
    setRevokeTarget(null)
    run(revokeMemberAction({ membershipId: target.id }))
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isSelf = member.userId === currentUserId
            const status = MEMBERSHIP_STATUS_LABEL[member.status]
            return (
              <TableRow key={member.id}>
                <TableCell className="text-foreground font-medium">
                  {member.fullName}
                  {isSelf && <span className="text-muted-foreground ml-2 text-xs">(você)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{member.email ?? '—'}</TableCell>
                <TableCell>
                  {isSelf || member.status !== 'active' || !canChangeRole ? (
                    roleLabel(member.role)
                  ) : (
                    <select
                      defaultValue={member.role}
                      disabled={isPending}
                      onChange={(e) => changeRole(member.id, e.target.value)}
                      className="border-input bg-card text-foreground focus:border-ring rounded-lg border px-2 py-1 text-sm outline-none"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {TEAM_ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant} size="sm">
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(member.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {!isSelf && (
                    <div className="flex justify-end gap-1.5">
                      {canSuspend && member.status === 'active' && (
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          disabled={isPending}
                          onClick={() => setSuspendTarget(member)}
                          aria-label={`Suspender ${member.fullName}`}
                        >
                          <Ban />
                        </Button>
                      )}
                      {canSuspend && member.status === 'suspended' && (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={isPending}
                          onClick={() => run(reactivateMemberAction({ membershipId: member.id }))}
                          aria-label={`Reativar ${member.fullName}`}
                        >
                          <RotateCcw />
                        </Button>
                      )}
                      {canRevoke && member.status !== 'revoked' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                          onClick={() => setRevokeTarget(member)}
                          aria-label={`Revogar vínculo de ${member.fullName}`}
                        >
                          <ShieldOff />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog
        open={suspendTarget !== null}
        onClose={() => setSuspendTarget(null)}
        title={`Suspender ${suspendTarget?.fullName ?? ''}`}
        description="A pessoa perde acesso imediatamente. Você pode reativar depois."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSuspend}
              disabled={reason.trim().length < 5}
            >
              Suspender
            </Button>
          </>
        }
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Motivo da suspensão (obrigatório, fica registrado na auditoria)"
          className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
        />
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title={`Revogar vínculo de ${revokeTarget?.fullName ?? ''}`}
        description="Isso remove permanentemente o acesso desta pessoa a esta pousada. O histórico é preservado."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmRevoke}>
              Revogar
            </Button>
          </>
        }
      />
    </div>
  )
}
