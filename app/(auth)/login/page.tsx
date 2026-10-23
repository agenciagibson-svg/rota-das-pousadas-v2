import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Card } from '@/components/ui/card'
import { GuestSignIn } from '@/features/auth'
import { DemoNotice } from '@/components/demo/demo-notice'
import { isGoogleAuthEnabled, isSupabaseConfigured } from '@/lib/env'
import {
  authErrorMessage,
  isBookingNextPath,
  isEmbeddedBrowser,
} from '@/features/auth/passwordless'
import { safeNextPath } from '@/features/auth/profile'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string; modo?: string }>
}) {
  const { next, erro, modo } = await searchParams
  const safeNext = safeNextPath(next) ?? undefined
  const bookingFocus = isBookingNextPath(safeNext)
  const notice = authErrorMessage(erro)
  // O Google recusa login dentro do navegador do Instagram/Facebook/TikTok:
  // ali o botão some e o código por e-mail fica como caminho principal.
  const userAgent = (await headers()).get('user-agent')
  const googleEnabled = isGoogleAuthEnabled() && !isEmbeddedBrowser(userAgent)

  return (
    <Card radius="3xl" border={false} className="p-6 sm:p-8">
      <h1 className="text-h1 text-foreground">
        {bookingFocus ? 'Entre para reservar' : 'Bem-vindo de volta'}
      </h1>
      <p className="text-muted-foreground mt-2 text-base">
        {bookingFocus
          ? 'Falta pouco: entre e você volta direto para a sua reserva.'
          : 'Entre para gerenciar suas viagens, favoritos e reservas.'}
      </p>
      {!isSupabaseConfigured() && (
        <DemoNotice
          className="mt-6"
          action={{ href: '/minhas-reservas', label: 'Ver a área do hóspede' }}
        >
          Este ambiente de teste não tem banco conectado, então o login não funciona aqui.
        </DemoNotice>
      )}
      <div className="mt-6">
        <GuestSignIn
          next={safeNext}
          googleEnabled={googleEnabled}
          bookingFocus={bookingFocus}
          initialMode={bookingFocus || notice || modo === 'codigo' ? 'code' : 'password'}
          notice={notice}
        />
      </div>
    </Card>
  )
}
