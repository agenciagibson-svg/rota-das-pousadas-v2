import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { ForgotPasswordForm } from '@/features/auth'
import { parseResetAudience } from '@/features/auth/password-reset'

export const metadata: Metadata = {
  title: 'Esqueci minha senha',
  robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ para?: string; email?: string }>
}) {
  const { para, email } = await searchParams
  const audience = parseResetAudience(para)

  return (
    <Card radius="3xl" className="shadow-card p-8">
      <h1 className="text-foreground font-serif text-3xl font-semibold">Esqueceu a senha?</h1>
      <p className="text-muted-foreground mt-2 text-base">
        Sem problema. Informe o e-mail da sua conta e enviamos um link para você criar uma nova
        senha.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm audience={audience} defaultEmail={email?.slice(0, 120) ?? ''} />
      </div>
    </Card>
  )
}
