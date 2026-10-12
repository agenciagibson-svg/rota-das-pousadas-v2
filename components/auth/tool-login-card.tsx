import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { Card } from '@/components/ui/card'

/**
 * Wrapper de login da equipe da plataforma (admin) — deliberadamente sem
 * card de marketing (nem o do login de hóspede em app/(auth)/layout.tsx,
 * nem a vitrine de benefícios do parceiro em partner-login-showcase.tsx):
 * quem está entrando pra *gerenciar a plataforma* não precisa ver propaganda.
 */
export function ToolLoginCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5 py-8">
      <div className="w-full max-w-md">
        <Link
          href="/"
          aria-label="Rota das Pousadas, página inicial"
          className="text-foreground mx-auto mb-8 flex w-fit"
        >
          <Logo className="h-6" />
        </Link>

        <Card radius="3xl" border={false} className="p-6 sm:p-8">
          <h1 className="text-h2 text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  )
}
