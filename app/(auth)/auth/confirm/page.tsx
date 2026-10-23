import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmailLinkConfirm } from '@/features/auth'
import {
  authRedirectOrigin,
  emailLinkTypeFrom,
  guestLoginPath,
  isPlausibleTokenHash,
  nextFromLinkParam,
} from '@/features/auth/passwordless'
import { publicEnv } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
  // O endereço tem o token do link: não vaza para outros sites pelo Referer.
  referrer: 'no-referrer',
}

/**
 * Link do e-mail de entrada (`/auth/confirm?token_hash=…&type=email&next=…`),
 * no formato do Supabase SSR. Diferente do exemplo oficial, o token NÃO é
 * consumido ao abrir a página: antivírus e pré-visualização de e-mail abrem
 * links sozinhos e gastariam o link e o código de uma vez. A pessoa toca em
 * "Entrar" e só então a Server Action chama `verifyOtp` (mesmo cuidado do
 * `/redefinir-senha`).
 */
export default async function ConfirmEmailLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const params = await searchParams
  const h = await headers()
  const currentOrigin = authRedirectOrigin({
    siteUrl: publicEnv.siteUrl,
    host: h.get('x-forwarded-host') ?? h.get('host'),
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  })
  const next = nextFromLinkParam(params.next, [publicEnv.siteUrl, currentOrigin])
  const type = emailLinkTypeFrom(params.type)
  const tokenHash = isPlausibleTokenHash(params.token_hash) ? params.token_hash : null

  return (
    <Card radius="3xl" border={false} className="p-6 sm:p-8">
      <h1 className="text-h1 text-foreground">Entrar na sua conta</h1>
      {tokenHash && type ? (
        <>
          <p className="text-muted-foreground mt-2 text-base">
            Toque no botão para confirmar que é você. Não precisa de senha.
          </p>
          <div className="mt-6">
            <EmailLinkConfirm tokenHash={tokenHash} type={type} next={next ?? undefined} />
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mt-2 text-base">
            Este link está incompleto ou inválido. Peça um código novo: ele chega no seu e-mail em
            instantes.
          </p>
          <Link
            href={guestLoginPath(next, 'link')}
            className={buttonVariants({ size: 'lg', className: 'mt-6 w-full' })}
          >
            Receber código por e-mail
          </Link>
        </>
      )}
    </Card>
  )
}
