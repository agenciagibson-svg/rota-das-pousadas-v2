'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import {
  emailCodeRequestSchema,
  emailCodeVerifySchema,
  type EmailCodeRequestInput,
  type EmailCodeVerifyInput,
} from '../schemas'
import { requestEmailCodeAction, verifyEmailCodeAction } from '../actions'
import { resendSecondsLeft } from '../passwordless'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * Entrar sem senha: a pessoa informa o e-mail, recebe um código de 6 números
 * e digita aqui. A conta é criada por trás no primeiro acesso. As mensagens
 * não dizem se o e-mail já tinha conta.
 */
export function EmailCodeForm({ next }: { next?: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState<number | null>(null)

  if (!sentTo) {
    return (
      <EmailStep
        next={next}
        onSent={(email) => {
          setSentTo(email)
          setSentAt(Date.now())
        }}
      />
    )
  }
  return (
    <CodeStep
      email={sentTo}
      next={next}
      sentAt={sentAt}
      onResent={() => setSentAt(Date.now())}
      onChangeEmail={() => {
        setSentTo(null)
        setSentAt(null)
      }}
    />
  )
}

function EmailStep({ next, onSent }: { next?: string; onSent: (email: string) => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailCodeRequestInput>({
    resolver: zodResolver(emailCodeRequestSchema),
    defaultValues: { email: '', next },
  })

  async function onSubmit(values: EmailCodeRequestInput) {
    setFormError(null)
    const result = await requestEmailCodeAction({ email: values.email, next })
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    onSent(values.email.trim().toLowerCase())
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      {formError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando…' : 'Receber código por e-mail'}
      </Button>
    </form>
  )
}

function useSecondsLeft(sentAt: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (sentAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [sentAt])
  return resendSecondsLeft(sentAt, now)
}

function CodeStep({
  email,
  next,
  sentAt,
  onResent,
  onChangeEmail,
}: {
  email: string
  next?: string
  sentAt: number | null
  onResent: () => void
  onChangeEmail: () => void
}) {
  const router = useRouter()
  const secondsLeft = useSecondsLeft(sentAt)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailCodeVerifyInput>({
    resolver: zodResolver(emailCodeVerifySchema),
    defaultValues: { email, code: '', next },
  })

  async function onSubmit(values: EmailCodeVerifyInput) {
    setFormError(null)
    setNotice(null)
    const result = await verifyEmailCodeAction({ email, code: values.code, next })
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setDone(true)
    router.push(result.data.redirectTo)
    router.refresh()
  }

  async function resend() {
    setFormError(null)
    setNotice(null)
    setResending(true)
    const result = await requestEmailCodeAction({ email, next })
    setResending(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    onResent()
    setNotice('Enviamos um código novo. Use sempre o último que chegar.')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div
        role="status"
        className="border-success/30 bg-success/10 text-foreground flex items-start gap-3 rounded-2xl border p-4 text-sm"
      >
        <MailCheck className="text-success mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Confira seu e-mail</p>
          <p className="mt-1">
            Enviamos um código de 6 números para <strong>{email}</strong>. Não chegou? Veja a caixa
            de spam ou promoções.
          </p>
        </div>
      </div>
      <Input
        label="Código"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="000000"
        className="text-lg tracking-widest tabular-nums"
        error={errors.code?.message}
        {...register('code')}
      />
      {formError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {formError}
        </p>
      )}
      {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting || done} className="w-full">
        {isSubmitting || done ? 'Entrando…' : 'Entrar'}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-3"
          disabled={secondsLeft > 0 || resending}
          onClick={() => void resend()}
        >
          {resending
            ? 'Enviando…'
            : secondsLeft > 0
              ? `Reenviar código em ${secondsLeft}s`
              : 'Reenviar código'}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={onChangeEmail}>
          Usar outro e-mail
        </Button>
      </div>
    </form>
  )
}
