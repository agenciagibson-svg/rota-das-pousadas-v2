'use client'

import { useState } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmailCodeForm } from './email-code-form'
import { GoogleSignInButton } from './google-sign-in-button'
import { LoginForm } from './login-form'
import { OrDivider } from './or-divider'

export type GuestSignInMode = 'code' | 'password'

/**
 * Login do hóspede: código por e-mail (sem senha), Google (quando ligado) e
 * senha. Quem chega de uma reserva abre direto no código, com o texto que
 * explica que não precisa criar senha. A senha continua a um toque.
 */
export function GuestSignIn({
  next,
  googleEnabled,
  bookingFocus,
  initialMode,
  notice,
}: {
  next?: string
  googleEnabled: boolean
  bookingFocus: boolean
  initialMode: GuestSignInMode
  notice: string | null
}) {
  const [mode, setMode] = useState<GuestSignInMode>(initialMode)

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-foreground rounded-2xl border p-4 text-sm"
        >
          {notice}
        </p>
      )}
      {bookingFocus && (
        <p className="bg-secondary text-foreground rounded-2xl p-4 text-sm">
          Para reservar, entre com seu e-mail. Enviamos um código; não precisa criar senha.
        </p>
      )}

      {googleEnabled && (
        <>
          <GoogleSignInButton next={next} />
          <OrDivider />
        </>
      )}

      {mode === 'code' ? (
        <>
          <EmailCodeForm next={next} />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 self-center px-3"
            onClick={() => setMode('password')}
          >
            <KeyRound />
            Entrar com senha
          </Button>
        </>
      ) : (
        <>
          <LoginForm next={next} />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 self-center px-3"
            onClick={() => setMode('code')}
          >
            <Mail />
            Entrar sem senha: receber código por e-mail
          </Button>
        </>
      )}
    </div>
  )
}
