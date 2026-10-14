'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { inviteMemberAction } from '../actions'
import { TEAM_ROLE_LABEL, type TeamRole } from './role-labels'
import { SAVE_FAILED_MESSAGE, formErrorMessage, keepValuesOnSubmit } from '@/lib/forms'

const ASSIGNABLE_ROLES: TeamRole[] = [
  'admin_pousada',
  'recepcionista',
  'financeiro_pousada',
  'governanca',
  'proprietario',
]

/** Campos com lugar na tela para mostrar o erro; o resto vai para a mensagem geral. */
const VISIBLE_FIELDS = ['email', 'role']

export function InviteMemberForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  function submit(formData: FormData, form: HTMLFormElement) {
    setError(null)
    setFieldErrors({})
    setMessage(null)
    const email = String(formData.get('email') ?? '')
    const role = String(formData.get('role') ?? '') as TeamRole

    startTransition(async () => {
      // Sem o try/catch, uma queda de rede derrubava a tela no error boundary.
      try {
        const result = await inviteMemberAction({ email, role })
        if (!result.ok) {
          const errors = result.fieldErrors ?? {}
          setFieldErrors(errors)
          setError(formErrorMessage(result.error, errors, VISIBLE_FIELDS))
          return
        }
        form.reset()
        setMessage(
          result.data.emailSent
            ? 'Convite registrado e e-mail enviado. A pessoa entra no painel com esse e-mail e aceita o convite. Se ainda não tiver conta, ela cria uma com o mesmo e-mail e você convida de novo.'
            : 'Convite registrado, mas o e-mail não pôde ser enviado agora. Avise a pessoa para entrar no painel com esse e-mail e aceitar o convite.',
        )
        router.refresh()
      } catch {
        setError(SAVE_FAILED_MESSAGE)
      }
    })
  }

  return (
    <form
      onSubmit={keepValuesOnSubmit(submit)}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex-1">
        <Input
          label="E-mail da pessoa"
          name="email"
          type="email"
          required
          placeholder="pessoa@email.com"
          error={fieldErrors.email}
        />
      </div>
      {/* O erro fica fora do <label> para não entrar no nome acessível do campo. */}
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">Papel</span>
          <select
            name="role"
            defaultValue="recepcionista"
            aria-invalid={fieldErrors.role ? true : undefined}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 aria-invalid:border-destructive rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {TEAM_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>
        {fieldErrors.role && (
          <p role="alert" className="text-destructive text-xs">
            {fieldErrors.role}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        <UserPlus className="size-4" />
        {isPending ? 'Convidando…' : 'Convidar'}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium sm:basis-full">
          {error}
        </p>
      )}
      {message && <p className="text-primary text-sm font-medium sm:basis-full">{message}</p>}
    </form>
  )
}
