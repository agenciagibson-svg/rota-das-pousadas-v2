import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SetupProgress } from '@/features/onboarding/setup'

/**
 * Configuração guiada: aparece no topo da Visão geral enquanto falta algum
 * passo obrigatório. Cada passo leva à tela onde se resolve e se marca sozinho
 * quando o dado existe (ver `features/onboarding/setup.ts`).
 */
export function SetupChecklist({ progress }: { progress: SetupProgress }) {
  if (progress.complete) return null
  const pct = Math.round((progress.requiredDone / progress.requiredTotal) * 100)
  const pending = progress.steps.filter((s) => !s.done)
  const done = progress.steps.filter((s) => s.done && !s.optional)

  return (
    <Card className="mb-5 p-5" aria-labelledby="setup-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-title" className="text-foreground font-display text-lg font-medium">
          Deixe sua pousada pronta para receber reservas
        </h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          {progress.requiredDone} de {progress.requiredTotal} passos
        </span>
      </div>
      <div
        className="bg-secondary mt-3 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Configuração da pousada"
      >
        {/* Largura dinâmica: exceção permitida (AI_RULES regra 4). */}
        <div className="bg-success h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>

      <ul className="divide-border mt-4 divide-y">
        {pending.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="hover:bg-secondary/60 -mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2"
            >
              <Circle className="text-muted-foreground size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="text-foreground flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {step.label}
                  {step.optional && <Badge size="sm">Opcional</Badge>}
                </span>
                <span className="text-muted-foreground block text-sm">{step.hint}</span>
              </span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <p className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {done.map((step) => (
            <span key={step.id} className={cn('inline-flex items-center gap-1.5')}>
              <CheckCircle2 className="text-success size-4" />
              {step.label}
            </span>
          ))}
        </p>
      )}
    </Card>
  )
}
