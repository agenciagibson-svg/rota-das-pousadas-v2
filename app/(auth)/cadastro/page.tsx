import type { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { GoogleSignInButton, OrDivider, SignupForm } from '@/features/auth'
import { headers } from 'next/headers'
import { isGoogleAuthEnabled } from '@/lib/env'
import { isEmbeddedBrowser } from '@/features/auth/passwordless'
import { safeNextPath } from '@/features/auth/profile'

export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: false },
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const safeNext = safeNextPath(next) ?? undefined
  const userAgent = (await headers()).get('user-agent')
  const googleEnabled = isGoogleAuthEnabled() && !isEmbeddedBrowser(userAgent)
  const codeLoginHref = `/login?modo=codigo${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ''}`

  return (
    <Card radius="3xl" border={false} className="p-6 sm:p-8">
      <h1 className="text-h1 text-foreground">Crie sua conta</h1>
      <p className="text-muted-foreground mt-2 text-base">
        Comece a planejar sua próxima rota pelo Brasil.
      </p>
      {googleEnabled && (
        <div className="mt-6 flex flex-col gap-5">
          <GoogleSignInButton next={safeNext} />
          <OrDivider />
        </div>
      )}
      <div className={googleEnabled ? 'mt-5' : 'mt-6'}>
        <SignupForm next={safeNext} />
      </div>
      <Link
        href={codeLoginHref}
        className={buttonVariants({
          variant: 'ghost',
          className: 'mt-4 min-h-11 w-full px-3 text-sm',
        })}
      >
        Prefere não criar senha? Receber código por e-mail
      </Link>
    </Card>
  )
}
