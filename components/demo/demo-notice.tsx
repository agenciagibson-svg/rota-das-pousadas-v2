import Link from 'next/link'
import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Aviso do modo demonstração (preview sem banco conectado): deixa claro que
 * os dados da tela são fictícios. Só aparece quando o Supabase não está
 * configurado — em produção as telas mostram dados reais.
 */
export function DemoNotice({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: { href: string; label: string }
  className?: string
}) {
  return (
    <div
      role="note"
      className={cn(
        'border-ipe/60 bg-ipe/15 text-foreground flex flex-col gap-3 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center',
        className,
      )}
    >
      <FlaskConical className="size-5 shrink-0" aria-hidden />
      <p className="flex-1">
        <strong className="font-semibold">Demonstração com dados fictícios.</strong> {children}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="shrink-0 font-semibold underline underline-offset-4 hover:no-underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
