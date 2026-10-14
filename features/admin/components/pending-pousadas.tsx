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
    return <p className="text-muted-foreground text-sm">Nenhuma pousada aguardando aprovação.</p>
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
        <div
          key={p.id}
          className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
        >
          <div className="min-w-0">
            <div className="text-foreground truncate font-medium">{p.name}</div>
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <MapPin className="size-3" /> {p.city}, {p.state}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              disabled={pending}
              onClick={() => run(rejectPousadaAction, p.id)}
              className="border-border text-foreground hover:bg-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Rejeitar
            </button>
            <button
              disabled={pending}
              onClick={() => run(approvePousadaAction, p.id)}
              className="bg-ocean text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-105 disabled:opacity-50"
            >
              Aprovar
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
