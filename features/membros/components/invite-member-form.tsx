'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { inviteMemberAction } from '../actions'
import { TEAM_ROLE_LABEL, type TeamRole } from './role-labels'

const ASSIGNABLE_ROLES: TeamRole[] = [
  'admin_pousada',
  'recepcionista',
  'financeiro_pousada',
  'governanca',
  'proprietario',
]

export function InviteMemberForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function submit(formData: FormData) {
    setError(null)
    setMessage(null)
    const email = String(formData.get('email') ?? '')
    const role = String(formData.get('role') ?? '') as TeamRole

    startTransition(async () => {
      const result = await inviteMemberAction({ email, role })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage(
        'Se existir uma conta com esse e-mail na plataforma, o convite foi registrado. Envio automático por e-mail ainda não está disponível — avise a pessoa diretamente.',
      )
      router.refresh()
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          label="E-mail da pessoa"
          name="email"
          type="email"
          required
          placeholder="pessoa@email.com"
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Papel
        </span>
        <select
          name="role"
          defaultValue="recepcionista"
          className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {TEAM_ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={isPending}>
        <UserPlus className="size-4" />
        {isPending ? 'Convidando...' : 'Convidar'}
      </Button>
      {error && <p className="text-sm font-medium text-destructive sm:basis-full">{error}</p>}
      {message && <p className="text-sm font-medium text-primary sm:basis-full">{message}</p>}
    </form>
  )
}
