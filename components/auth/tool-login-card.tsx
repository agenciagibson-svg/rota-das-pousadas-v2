import type { ReactNode } from 'react'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

/**
 * Wrapper de login pra painel de parceiro/admin — deliberadamente sem o
 * card de marketing do login de hóspede (app/(auth)/layout.tsx): quem está
 * entrando pra *gerenciar* não precisa ver propaganda de hospedagem.
 */
export function ToolLoginCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string
  subtitle: string
  accent: 'primary' | 'ocean'
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-2.5">
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-full text-primary-foreground',
              accent === 'ocean' ? 'bg-ocean' : 'bg-primary',
            )}
          >
            <Compass className="size-5" />
          </span>
          <span className="font-serif text-lg font-semibold text-foreground">Rota das Pousadas</span>
        </Link>

        <Card radius="3xl" className="p-8 shadow-card">
          <h1 className="font-serif text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  )
}
