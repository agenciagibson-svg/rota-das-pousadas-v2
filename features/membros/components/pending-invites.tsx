'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { acceptInviteAction, declineInviteAction } from '../actions'
import { roleLabel } from './role-labels'
import type { PendingInvite } from '../types'

/**
 * Lista de convites pendentes do PRÓPRIO usuário, com aceitar/recusar (0049).
 * Usada na tela "Convite pendente" (único vínculo é um convite), na escolha de
 * pousada e como faixa discreta dentro do painel quando já há vínculo ativo.
 * Depois de responder, `router.refresh()` faz o layout do /dashboard reavaliar
 * o contexto de tenant — é ele quem decide para onde o usuário vai.
 */
export function PendingInvites({ invites, compact = false }: { invites: PendingInvite[]; compact?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (invites.length === 0) return null

  function respond(membershipId: string, accept: boolean) {
    setError(null)
    setBusyId(membershipId)
    startTransition(async () => {
      const result = accept
        ? await acceptInviteAction({ membershipId })
        : await declineInviteAction({ membershipId })
      setBusyId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {invites.map((invite) => {
        const busy = isPending && busyId === invite.membershipId
        return (
          <Card key={invite.membershipId} className={compact ? 'p-3' : 'p-4'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{invite.pousadaName}</span>
                  <Badge variant="goldSoft" size="sm">
                    {roleLabel(invite.role)}
                  </Badge>
                </div>
                {!compact && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Você foi convidado para a equipe desta pousada.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size={compact ? 'xs' : 'sm'}
                  disabled={isPending}
                  onClick={() => respond(invite.membershipId, true)}
                >
                  <Check className="size-3.5" />
                  {busy ? 'Aceitando…' : 'Aceitar'}
                </Button>
                <Button
                  type="button"
                  size={compact ? 'xs' : 'sm'}
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => respond(invite.membershipId, false)}
                >
                  <X className="size-3.5" />
                  Recusar
                </Button>
              </div>
            </div>
          </Card>
        )
      })}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  )
}
