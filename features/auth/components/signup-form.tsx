'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signupSchema, type SignupInput } from '../schemas'
import { signUpAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { safeNextPath } from '@/features/auth/profile'

type SignupFormProps = {
  next?: string
}

export function SignupForm({ next }: SignupFormProps) {
  const router = useRouter()
  const safeNext = safeNextPath(next)
  const loginHref = safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function onSubmit(values: SignupInput) {
    setFormError(null)
    setMessage(null)
    const result = await signUpAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    if (result.data.needsEmailConfirmation) {
      setMessage('Conta criada! Confirme seu e-mail para acessar o painel.')
      return
    }
    router.push(safeNext ?? result.data.redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nome"
        type="text"
        autoComplete="name"
        placeholder="Seu nome"
        error={errors.name?.message}
        {...register('name')}
      />
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
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        error={errors.password?.message}
        {...register('password')}
      />
      {formError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {formError}{' '}
          {formError.includes('já tem uma conta') && (
            <Link href={loginHref} className="underline underline-offset-4">
              Entrar agora
            </Link>
          )}
        </p>
      )}
      {message && <p className="text-primary text-sm font-medium">{message}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'Criando conta…' : 'Criar conta'}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Ao criar a conta, você concorda com os{' '}
        <Link href="/termos" target="_blank" className="text-primary underline">
          Termos de Uso
        </Link>{' '}
        e com a{' '}
        <Link href="/privacidade" target="_blank" className="text-primary underline">
          Política de Privacidade
        </Link>
        .
      </p>
      <p className="text-muted-foreground text-center text-sm">
        Já tem conta?{' '}
        <Link href={loginHref} className="text-primary font-semibold hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
