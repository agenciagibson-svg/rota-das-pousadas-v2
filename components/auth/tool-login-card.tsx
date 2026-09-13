import type { ReactNode } from 'react'
import Link from 'next/link'
import { Compass } from 'lucide-react'
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
    <div className="bg-secondary/40 flex min-h-screen items-center justify-center px-5 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-2.5">
          <span className="bg-ocean text-primary-foreground flex size-9 items-center justify-center rounded-full">
            <Compass className="size-5" />
          </span>
          <span className="text-foreground font-serif text-lg font-semibold">
            Rota das Pousadas
          </span>
        </Link>

        <Card radius="3xl" className="shadow-card p-8">
          <h1 className="text-foreground font-serif text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  )
}
