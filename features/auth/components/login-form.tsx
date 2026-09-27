'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginSchema, type LoginInput } from '../schemas'
import { signInAction, signInAdminAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type LoginVariant = 'guest' | 'partner' | 'admin'

type LoginFormProps = {
  next?: string
  variant?: LoginVariant
}

function getSafeNext(next?: string | null) {
  return next?.startsWith('/') ? next : null
}

/** Destino padrão pós-login por variante — só entra em jogo quando não há `?next=`. */
const DEFAULT_REDIRECT: Record<LoginVariant, string> = {
  guest: '/minhas-reservas',
  partner: '/dashboard',
  admin: '/admin',
}

export function LoginForm({ next, variant = 'guest' }: LoginFormProps) {
  const router = useRouter()
  const safeNext = getSafeNext(next)
  const signupHref = safeNext ? `/cadastro?next=${encodeURIComponent(safeNext)}` : '/cadastro'
  const [formError, setFormError] = useState<string | null>(null)
  const forgotHref =
    variant === 'guest'
      ? '/esqueci-senha'
      : `/esqueci-senha?para=${variant === 'partner' ? 'parceiro' : 'admin'}`
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
    // Admin precisa confirmar platformRole no servidor DEPOIS da senha bater
    // (e desloga se não for staff) — hóspede/parceiro reaproveitam a mesma
    // action, só muda o destino do redirect no cliente.
    const result =
      variant === 'admin' ? await signInAdminAction(values) : await signInAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    router.push(safeNext ?? DEFAULT_REDIRECT[variant])
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
      <Link
        href={forgotHref}
        className="text-primary -mt-1 w-fit self-end text-sm font-semibold hover:underline"
      >
        Esqueci minha senha
      </Link>
      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
      {variant !== 'admin' && (
        <p className="text-muted-foreground text-center text-sm">
          Não tem conta?{' '}
          <Link
            href={variant === 'partner' ? '/cadastro?next=/anunciar' : signupHref}
            className="text-primary font-semibold hover:underline"
          >
            {variant === 'partner' ? 'Cadastrar minha pousada' : 'Criar conta'}
          </Link>
        </p>
      )}
    </form>
  )
}
