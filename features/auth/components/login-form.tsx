'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginSchema, type LoginInput } from '../schemas'
import { signInAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type LoginFormProps = {
  next?: string
}

function getSafeNext(next?: string | null) {
  return next?.startsWith('/') ? next : null
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter()
  const safeNext = getSafeNext(next)
  const signupHref = safeNext ? `/cadastro?next=${encodeURIComponent(safeNext)}` : '/cadastro'
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setFormError(null)
    const result = await signInAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    router.push(safeNext ?? result.data.redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="voce@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Senha"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link href={signupHref} className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  )
}
