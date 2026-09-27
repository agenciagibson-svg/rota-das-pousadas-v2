import type { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ResetPasswordForm } from '@/features/auth'
import { parseResetAudience } from '@/features/auth/password-reset'

export const metadata: Metadata = {
  title: 'Criar nova senha',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; para?: string }>
}) {
  const { token, para } = await searchParams
  const audience = parseResetAudience(para)
  const validToken = typeof token === 'string' && /^[A-Za-z0-9_-]{10,512}$/.test(token)
  const forgotHref = audience === 'hospede' ? '/esqueci-senha' : `/esqueci-senha?para=${audience}`

  return (
    <Card radius="3xl" className="shadow-card p-8">
      <h1 className="text-foreground font-serif text-3xl font-semibold">Criar nova senha</h1>
      {validToken ? (
        <>
          <p className="text-muted-foreground mt-2 text-base">
            Escolha uma senha nova, com pelo menos 8 caracteres. Depois de salvar, você já entra na
            sua conta.
          </p>
          <div className="mt-6">
            <ResetPasswordForm token={token} audience={audience} />
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mt-2 text-base">
            Este link está incompleto ou inválido. Peça um novo link para criar sua senha — ele
            chega no seu e-mail em instantes.
          </p>
          <Link
            href={forgotHref}
            className={buttonVariants({ size: 'lg', className: 'mt-6 w-full' })}
          >
            Pedir novo link
          </Link>
        </>
      )}
    </Card>
  )
}
