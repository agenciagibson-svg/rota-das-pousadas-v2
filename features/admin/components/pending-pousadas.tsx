'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { approvePousadaAction, rejectPousadaAction } from '../actions'
import type { PendingPousada } from '../types'

export function PendingPousadas({ items }: { items: PendingPousada[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma pousada aguardando aprovação.</p>
  }

  function run(
    action: (input: { id: string }) => Promise<{ ok: boolean; error?: string }>,
    id: string,
  ) {
    setError(null)
    startTransition(async () => {
      const result = await action({ id })
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível concluir a ação.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{p.name}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {p.city}, {p.state}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              disabled={pending}
              onClick={() => run(rejectPousadaAction, p.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Rejeitar
            </button>
            <button
              disabled={pending}
              onClick={() => run(approvePousadaAction, p.id)}
              className="rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-105 disabled:opacity-50"
            >
              Aprovar
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
