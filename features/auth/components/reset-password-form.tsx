'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas'
import { resetPasswordAction } from '../actions'
import type { ResetAudience } from '../password-reset'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ResetPasswordForm({ token, audience }: { token: string; audience: ResetAudience }) {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirm: '', audience },
  })

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null)
    const result = await resetPasswordAction({ ...values, token, audience })
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setDone(true)
    router.replace(result.data.redirectTo)
    router.refresh()
  }

  const forgotHref = audience === 'hospede' ? '/esqueci-senha' : `/esqueci-senha?para=${audience}`

  if (done) {
    return (
      <p
        role="status"
        className="border-success/30 bg-success/10 text-foreground rounded-2xl border p-4 text-sm font-medium"
      >
        Senha alterada! Entrando na sua conta…
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nova senha"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Repita a nova senha"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Digite de novo"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {show ? 'Esconder senhas' : 'Mostrar senhas'}
      </button>
      {formError && (
        <div role="alert" className="text-destructive text-sm font-medium">
          <p>{formError}</p>
          <Link
            href={forgotHref}
            className="text-primary mt-1 inline-block font-semibold hover:underline"
          >
            Pedir um novo link
          </Link>
        </div>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  )
}
