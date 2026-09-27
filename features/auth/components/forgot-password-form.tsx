'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas'
import { requestPasswordResetAction } from '../actions'
import { LOGIN_PATH, type ResetAudience } from '../password-reset'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ForgotPasswordForm({
  audience = 'hospede',
  defaultEmail = '',
}: {
  audience?: ResetAudience
  defaultEmail?: string
}) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail, audience },
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null)
    const result = await requestPasswordResetAction({ ...values, audience })
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setSentTo(values.email.trim())
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Confira seu e-mail</p>
            <p className="mt-1">
              Se existir uma conta com <strong>{sentTo}</strong>, enviamos agora um link para criar
              uma nova senha. Ele vale por 1 hora.
            </p>
            <p className="mt-2 text-emerald-900/80">
              Não chegou em alguns minutos? Veja a caixa de spam ou promoções.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
          onClick={() => void onSubmit({ email: getValues('email'), audience })}
        >
          {isSubmitting ? 'Enviando…' : 'Enviar de novo'}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          <Link href={LOGIN_PATH[audience]} className="text-primary font-semibold hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="E-mail da sua conta"
        type="email"
        autoComplete="email"
        placeholder="voce@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'Enviando…' : 'Enviar link para nova senha'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Lembrou a senha?{' '}
        <Link href={LOGIN_PATH[audience]} className="text-primary font-semibold hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  )
}
